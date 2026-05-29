import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDataSync } from '@/contexts/DataSyncContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useBilling } from '@/contexts/BillingContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useFormationStructure, normalizeFormationVideoPayload } from '@/hooks/useFormationStructure';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Lock, Unlock, CheckCircle, ArrowRight, Play, BookOpen, PenTool, ChevronRight, Menu, Heart, Video, Presentation, FileText, Sparkles, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { VideoProgressProvider } from '@/components/classroom/VideoProgressTracker';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import VideoPlayer from '@/components/formations/VideoPlayer';
import PowerPointViewer from '@/components/formations/PowerPointViewer';
import ProgressivePlaylist from '@/components/classroom/ProgressivePlaylist';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import QuizPlayerInterface from '@/components/formations/QuizPlayerInterface';
import ChapterList from '@/components/lesson-player/ChapterList';
import TranscriptPanel from '@/components/lesson-player/TranscriptPanel';
import MindMapNavigation from '@/components/lesson-player/MindMapNavigation';
import NodeExplanationPanel from '@/components/lesson-player/NodeExplanationPanel';
import QuizPanel from '@/components/lesson-player/QuizPanel';
import QuestionPanel from '@/components/lesson-player/QuestionPanel';
import { tsToSeconds } from '@/components/lesson-player/types';
import NotesPanel from '@/components/lesson-player/NotesPanel';
import { cn } from '@/lib/utils';
import { formationForumUrlForRole } from '@/lib/forumDashboardPaths';
import { getEffectiveRole } from '@/lib/accountRoleMode';

const withTimeout = async (promise, ms, label) => {
  let t;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        t = window.setTimeout(() => reject(new Error(label)), ms);
      }),
    ]);
  } finally {
    if (t) window.clearTimeout(t);
  }
};

const DemoCoursePlayerContent = () => {
  const { yearId, moduleId, weekId, dayId } = useParams();
  const navigate = useNavigate();
  const { years, students, submitWriting, unlockNextDay } = useDataSync();
  const studentId = 's-1'; // Hardcoded for current user context simulation
  
  // Find Content
  const year = years.find(y => y.id === yearId);
  const module = year?.modules.find(m => m.id === moduleId);
  const week = module?.weeks.find(w => w.id === weekId);
  const day = week?.days.find(d => d.id === dayId);
  const student = students.find(s => s.id === studentId);
  
  const [step, setStep] = useState(1); // 1: Video, 2: Summary, 3: Writing, 4: Quiz
  const [writingText, setWritingText] = useState('');
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizScore, setQuizScore] = useState(null);

  // Load progress
  const progress = student?.progress?.completedDays[dayId] || {};
  const isUnlocked = student?.progress?.unlockedDays.includes(dayId);

  useEffect(() => {
    // If completed previously, allow free navigation or set to end
    if (progress.writingSubmitted) setStep(5); // 5 is completed view
  }, [progress]);

  if (!day) return <div className="text-white p-10">Contenu non trouvé</div>;
  if (!isUnlocked && false) return <div className="text-white p-10">Ce contenu est verrouillé. Terminez les jours précédents.</div>; // Disabled check for demo

  const handleWritingSubmit = () => {
    if (writingText.length < 50) {
      alert("La rédaction doit contenir au moins 50 caractères.");
      return;
    }
    submitWriting(studentId, dayId, writingText);
    setStep(4);
  };

  const handleQuizSubmit = () => {
    let correct = 0;
    day.content.quiz.forEach((q, idx) => {
      if (quizAnswers[idx] === q.correctAnswer) correct++;
    });
    const score = (correct / day.content.quiz.length) * 100;
    setQuizScore(score);
    
    if (score >= 60) {
      unlockNextDay(studentId, dayId);
      setTimeout(() => setStep(5), 1500);
    } else {
      alert(`Score: ${score}%. Vous devez obtenir au moins 60%. Réessayez.`);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1419] text-white flex flex-col">
      {/* Header Progress */}
      <div className="h-16 border-b border-white/10 flex items-center px-8 bg-[#15202B]">
         <div className="flex-1">
           <h1 className="text-lg font-bold flex items-center gap-2">
             <span className="text-gray-400">{module?.title}</span> <ChevronRight className="h-4 w-4"/>
             <span className="text-gray-400">{week?.title}</span> <ChevronRight className="h-4 w-4"/>
             <span className="text-[#D4AF37]">{day.title}</span>
           </h1>
         </div>
         <div className="flex gap-2">
            {[1, 2, 3, 4].map(s => (
               <div key={s} className={`h-2 w-8 rounded-full ${step >= s ? 'bg-[#D4AF37]' : 'bg-gray-700'}`} />
            ))}
         </div>
      </div>

      <div className="flex-1 container mx-auto p-6 max-w-5xl">
        <AnimatePresence mode='wait'>
          {step === 1 && (
            <motion.div key="video" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: -20}}>
               <Card className="bg-black border border-white/10 aspect-video flex items-center justify-center relative group">
                  <div className="text-center">
                    <Play className="h-20 w-20 text-white opacity-50 group-hover:opacity-100 transition-opacity cursor-pointer"/>
                    <p className="mt-4 text-gray-400">Simulation: Vidéo terminée</p>
                  </div>
               </Card>
               <div className="mt-6 flex justify-end">
                  <Button onClick={() => setStep(2)} className="bg-[#D4AF37] text-black hover:bg-yellow-500">
                    J'ai terminé la vidéo <ArrowRight className="ml-2 h-4 w-4"/>
                  </Button>
               </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="summary" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: -20}}>
               <Card className="bg-[#192734] border border-white/10 p-8">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <BookOpen className="text-[#D4AF37]"/> Ce que tu dois retenir
                  </h2>
                  <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: day.content.summary }} />
               </Card>
               <div className="mt-6 flex justify-end">
                  <Button onClick={() => setStep(3)} className="bg-[#D4AF37] text-black hover:bg-yellow-500">
                    J'ai bien lu et compris <ArrowRight className="ml-2 h-4 w-4"/>
                  </Button>
               </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="writing" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: -20}}>
               <Card className="bg-[#192734] border border-white/10 p-8">
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                    <PenTool className="text-[#D4AF37]"/> Qu'as-tu retenu ?
                  </h2>
                  <p className="text-gray-400 mb-6">{day.content.writingPrompt}</p>
                  <Textarea 
                    value={writingText}
                    onChange={(e) => setWritingText(e.target.value)}
                    placeholder="Écris ta réponse ici (min. 50 caractères)..."
                    className="h-64 bg-[#0F1419] border-white/10 text-white"
                  />
                  <div className="text-right text-sm text-gray-500 mt-2">
                    {writingText.length} caractères
                  </div>
               </Card>
               <div className="mt-6 flex justify-end">
                  <Button onClick={handleWritingSubmit} className="bg-[#D4AF37] text-black hover:bg-yellow-500">
                    Soumettre ma réponse <ArrowRight className="ml-2 h-4 w-4"/>
                  </Button>
               </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="quiz" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: -20}}>
               <Card className="bg-[#192734] border border-white/10 p-8">
                  <h2 className="text-2xl font-bold mb-6">Quiz de validation</h2>
                  <div className="space-y-8">
                     {day.content.quiz.map((q, idx) => (
                       <div key={q.id} className="space-y-3">
                         <h3 className="font-medium text-lg">{idx + 1}. {q.question}</h3>
                         <RadioGroup onValueChange={(val) => setQuizAnswers({...quizAnswers, [idx]: parseInt(val)})}>
                            {q.options.map((opt, optIdx) => (
                              <div key={optIdx} className="flex items-center space-x-2">
                                <RadioGroupItem value={optIdx.toString()} id={`q${idx}-${optIdx}`} className="border-white/20 text-[#D4AF37]" />
                                <Label htmlFor={`q${idx}-${optIdx}`} className="text-gray-300">{opt}</Label>
                              </div>
                            ))}
                         </RadioGroup>
                       </div>
                     ))}
                  </div>
               </Card>
               <div className="mt-6 flex justify-end">
                  <Button onClick={handleQuizSubmit} className="bg-[#D4AF37] text-black hover:bg-yellow-500">
                    Valider le Quiz <CheckCircle className="ml-2 h-4 w-4"/>
                  </Button>
               </div>
            </motion.div>
          )}
          
          {step === 5 && (
             <motion.div key="complete" initial={{opacity: 0, scale: 0.9}} animate={{opacity: 1, scale: 1}} className="text-center py-20">
                <div className="inline-block p-6 rounded-full bg-green-500/20 mb-6">
                  <CheckCircle className="h-16 w-16 text-green-500" />
                </div>
                <h2 className="text-4xl font-bold text-white mb-4">Félicitations !</h2>
                <p className="text-xl text-gray-400 mb-8">Vous avez complété le jour {day.dayNumber} avec succès.</p>
                <div className="flex justify-center gap-4">
                   <Button variant="outline" onClick={() => navigate('/formations')} className="border-white/10 text-white">
                     Retour aux formations
                   </Button>
                   <Button className="bg-[#D4AF37] text-black">
                     Jour suivant <ArrowRight className="ml-2 h-4 w-4"/>
                   </Button>
                </div>
             </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const SupabaseCoursePlayerContent = ({ formationId, onExit }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { status: billingStatus, inGrace } = useBilling();
  const { fetchStructure } = useFormationStructure();

  const effectiveFormationId = formationId || id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formation, setFormation] = useState(null);
  const [modules, setModules] = useState([]);
  const [path, setPath] = useState({ mIdx: 0, wIdx: 0, dIdx: 0 });
  const [activeItem, setActiveItem] = useState(null);
  const [activePanel, setActivePanel] = useState('video');
  const [notesText, setNotesText] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesStatus, setNotesStatus] = useState('idle');
  const [notesLastSavedAt, setNotesLastSavedAt] = useState(null);

  const videoPlayerRef = useRef(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);

  const [videoDone, setVideoDone] = useState(false);
  const [presentationDone, setPresentationDone] = useState(false);
  const [quizDone, setQuizDone] = useState(false);

  const [mindmapOpen, setMindmapOpen] = useState(false);
  const [mindmapMinimized, setMindmapMinimized] = useState(false);
  const [selectedMindmapPlayerNode, setSelectedMindmapPlayerNode] = useState(null);
  const [mindmapTab, setMindmapTab] = useState('mindmap'); // 'mindmap' | 'quiz'
  const [clickedMindmapNodeIds, setClickedMindmapNodeIds] = useState(new Set());
  const [liked, setLiked] = useState(false);

  const notesWordCount = useMemo(() => {
    const txt = String(notesText || '').trim();
    if (!txt) return 0;
    return txt.split(/\s+/).filter(Boolean).length;
  }, [notesText]);
  const notesFilled = useMemo(() => notesWordCount >= 100, [notesWordCount]);

  const [questionText, setQuestionText] = useState('');
  const [questionIsPublic, setQuestionIsPublic] = useState(true);
  const [questionSending, setQuestionSending] = useState(false);
  const [questionStatus, setQuestionStatus] = useState('idle');
  const [questionsSubTab, setQuestionsSubTab] = useState('ia');
  const [questionToast, setQuestionToast] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionCandidates, setMentionCandidates] = useState([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [selectedMentions, setSelectedMentions] = useState([]); // [{id,name,role}]
  const [questionClipStart, setQuestionClipStart] = useState('');
  const [questionClipEnd, setQuestionClipEnd] = useState('');
  const clipVideoRef = useRef(null);
  const clipStopAtRef = useRef(null);
  const [clipDuration, setClipDuration] = useState(null);
  const [clipPlayableUrl, setClipPlayableUrl] = useState('');
  const [myQuestions, setMyQuestions] = useState([]);
  const [myQuestionsLoading, setMyQuestionsLoading] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [editingCreatedAt, setEditingCreatedAt] = useState(null);

  const formationKey = formation?.id || effectiveFormationId;

  const formationForumBase = useMemo(() => {
    if (!formationKey) return '';
    const role = String(getEffectiveRole(user) || '').toLowerCase();
    return formationForumUrlForRole(role, formationKey);
  }, [formationKey, user]);

  const canEditQuestion = (createdAt) => {
    if (!createdAt) return false;
    const created = new Date(createdAt).getTime();
    if (!Number.isFinite(created)) return false;
    // Allow edits for 15 minutes after creation.
    return Date.now() - created <= 15 * 60 * 1000;
  };

  const loadMyQuestions = async () => {
    if (!user?.id) return;
    if (!formationKey) return;
    if (activeItem?.kind !== 'video') {
      setMyQuestions([]);
      return;
    }
    const { m, w, d } = deriveCtxFromActiveItem();
    const dayId = d?.id || null;
    const videoId = activeItem?.payload?.id || activeItem?.payload?.storagePath || activeItem?.payload?.url || '';

    setMyQuestionsLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('formation_student_questions')
        .select('id,created_at,question,is_public,clip_start_seconds,clip_end_seconds,video_id,day_id')
        .eq('formation_id', formationKey)
        .eq('student_id', user.id)
        .eq('day_id', dayId)
        .eq('video_id', videoId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (err) return;
      setMyQuestions(Array.isArray(data) ? data : []);
    } finally {
      setMyQuestionsLoading(false);
    }
  };

  const round05 = (v) => Math.round(Number(v) * 2) / 2;

  const setClipStartSafe = (nextStart) => {
    const s = nextStart === '' ? '' : String(round05(Math.max(0, Number(nextStart))));
    if (s === '') {
      setQuestionClipStart('');
      return;
    }
    const currentEnd = questionClipEnd === '' ? '' : String(round05(Number(questionClipEnd)));
    setQuestionClipStart(s);
    if (currentEnd !== '' && Number(currentEnd) < Number(s)) {
      setQuestionClipEnd(s);
    }
  };

  const setClipEndSafe = (nextEnd) => {
    const e = nextEnd === '' ? '' : String(round05(Math.max(0, Number(nextEnd))));
    if (e === '') {
      setQuestionClipEnd('');
      return;
    }
    const currentStart = questionClipStart === '' ? '' : String(round05(Number(questionClipStart)));
    if (currentStart !== '' && Number(e) < Number(currentStart)) {
      setQuestionClipEnd(currentStart);
      return;
    }
    setQuestionClipEnd(e);
  };

  const currentVideoMemo = useMemo(() => {
    if (activeItem?.kind !== 'video') return null;
    const raw = activeItem?.payload;
    if (!raw) return null;

    // Merge nested JSONB data into the video object.
    // IMPORTANT: do NOT let null/undefined top-level fields overwrite nested data.
    const rawData = raw?.data && typeof raw.data === 'object' ? raw.data : null;
    const merged = rawData
      ? {
          ...raw,
          ...rawData,
          timestamps:
            raw.timestamps != null
              ? raw.timestamps
              : rawData.timestamps,
          transcript:
            raw.transcript != null
              ? raw.transcript
              : rawData.transcript,
          mindmap:
            raw.mindmap != null
              ? raw.mindmap
              : rawData.mindmap,
          chapters:
            raw.chapters != null
              ? raw.chapters
              : rawData.chapters,
        }
      : raw;

    const keyed = normalizeFormationVideoPayload(merged);
    const normalizedUrl = normalizeVideoUrl(keyed?.type, keyed?.url);
    if (keyed?.url === normalizedUrl) return keyed;
    return { ...keyed, url: normalizedUrl };
  }, [activeItem?.kind, activeItem?.payload]);

  const seekVideoTo = (timeSeconds) => {
    if (!videoPlayerRef.current || typeof videoPlayerRef.current.seekTo !== 'function') return;
    videoPlayerRef.current.seekTo(timeSeconds);
  };

  const deriveCtxFromActiveItem = () => {
    const ctx = activeItem?.ctx || {};
    const mIdx = Number.isFinite(Number(ctx.mIdx)) ? Number(ctx.mIdx) : path.mIdx;
    const wIdx = Number.isFinite(Number(ctx.wIdx)) ? Number(ctx.wIdx) : path.wIdx;
    const dIdx = Number.isFinite(Number(ctx.dIdx)) ? Number(ctx.dIdx) : path.dIdx;
    const m = modules?.[mIdx] || null;
    const w = m?.weeks?.[wIdx] || null;
    const d = w?.days?.[dIdx] || null;
    return { mIdx, wIdx, dIdx, m, w, d };
  };

  const loadNotes = async () => {
    if (!user?.id) return;
    if (!formationKey) return;
    const { d } = deriveCtxFromActiveItem();
    const dayId = d?.id;
    const videoId = activeItem?.payload?.id || activeItem?.payload?.storagePath || activeItem?.payload?.url || '';
    if (!dayId) return;

    setNotesStatus('loading');

    const { data, error: err } = await supabase
      .from('formation_student_notes')
      .select('content')
      .eq('formation_id', formationKey)
      .eq('student_id', user.id)
      .eq('day_id', dayId)
      .eq('video_id', videoId)
      .maybeSingle();

    if (err) {
      setNotesStatus('error');
      return;
    }

    if (data?.content != null) setNotesText(String(data.content));
    setNotesStatus('saved');
  };

  const saveNotes = async () => {
    if (!user?.id) return;
    if (!formationKey) return;
    const { m, w, d } = deriveCtxFromActiveItem();
    const dayId = d?.id;
    const videoId = activeItem?.payload?.id || activeItem?.payload?.storagePath || activeItem?.payload?.url || '';
    if (!dayId) return;

    setNotesSaving(true);
    setNotesStatus('loading');
    try {
      const { error: err } = await supabase
        .from('formation_student_notes')
        .upsert(
          {
            formation_id: formationKey,
            student_id: user.id,
            module_id: m?.id || null,
            week_id: w?.id || null,
            day_id: dayId,
            video_id: videoId,
            content: notesText,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'formation_id,student_id,day_id,video_id' }
        );

      if (err) {
        setNotesStatus('error');
        return;
      }
      setNotesStatus('saved');
      setNotesLastSavedAt(new Date());
    } finally {
      setNotesSaving(false);
    }
  };

  const submitQuestion = async () => {
    if (!user?.id) return;
    if (!formationKey) return;
    const trimmed = String(questionText || '').trim();
    if (!trimmed) return;

    const { m, w, d } = deriveCtxFromActiveItem();
    const dayId = d?.id;
    const videoId = activeItem?.payload?.id || activeItem?.payload?.storagePath || activeItem?.payload?.url || '';
    if (!dayId) return;

    setQuestionSending(true);
    setQuestionStatus('loading');
    try {
      if (editingQuestionId && editingCreatedAt && !canEditQuestion(editingCreatedAt)) {
        setQuestionStatus('error');
        setQuestionToast('Délai dépassé: modification impossible après 15 minutes.');
        setEditingQuestionId(null);
        setEditingCreatedAt(null);
        return;
      }

      const clipStart = questionClipStart === '' ? null : Number(questionClipStart);
      const clipEnd = questionClipEnd === '' ? null : Number(questionClipEnd);
      const round05 = (v) => Math.round(v * 2) / 2;
      const safeClipStart = Number.isFinite(clipStart) && clipStart >= 0 ? round05(clipStart) : null;
      const safeClipEnd = Number.isFinite(clipEnd) && clipEnd >= 0 ? round05(clipEnd) : null;
      const normalizedClipStart = safeClipStart != null && safeClipEnd != null ? Math.min(safeClipStart, safeClipEnd) : safeClipStart;
      const normalizedClipEnd = safeClipStart != null && safeClipEnd != null ? Math.max(safeClipStart, safeClipEnd) : safeClipEnd;

      const basePayload = {
        formation_id: formationKey,
        student_id: user.id,
        module_id: m?.id || null,
        week_id: w?.id || null,
        day_id: dayId,
        video_id: videoId,
        video_storage_path: activeItem?.payload?.storagePath || null,
        video_url: currentVideoMemo?.url || activeItem?.payload?.url || null,
        question: trimmed,
        is_public: !!questionIsPublic,
        clip_start_seconds: normalizedClipStart,
        clip_end_seconds: normalizedClipEnd,
      };

      const updatePayload = {
        question: basePayload.question,
        is_public: basePayload.is_public,
        clip_start_seconds: basePayload.clip_start_seconds,
        clip_end_seconds: basePayload.clip_end_seconds,
        video_storage_path: basePayload.video_storage_path,
        video_url: basePayload.video_url,
      };

      const q = supabase.from('formation_student_questions');
      const result = editingQuestionId
        ? await q.update(updatePayload).eq('id', editingQuestionId).eq('student_id', user.id).select('id,created_at').maybeSingle()
        : await q.insert(basePayload).select('id,created_at').single();

      const err = result?.error;

      if (err) {
        setQuestionStatus('error');
        return;
      }

      const questionId = editingQuestionId || result?.data?.id;
      if (questionId && Array.isArray(selectedMentions) && selectedMentions.length > 0) {
        const mentionRows = selectedMentions.map((m) => ({
          formation_id: formationKey,
          question_id: questionId,
          mentioned_user_id: m.id,
          created_by: user.id,
        }));
        await supabase.from('formation_question_mentions').insert(mentionRows);

        const notifRows = selectedMentions.map((m) => ({
          formation_id: formationKey,
          question_id: questionId,
          recipient_id: m.id,
          sender_id: user.id,
          title: 'Nouvelle mention dans une question',
          message: trimmed.slice(0, 200),
        }));
        await supabase.from('formation_question_notifications').insert(notifRows);
      }
      setQuestionStatus('sent');
      setQuestionText('');
      setMentionQuery('');
      setMentionCandidates([]);
      setSelectedMentions([]);
      setQuestionClipStart('');
      setQuestionClipEnd('');
      setEditingQuestionId(null);
      setEditingCreatedAt(null);
      setQuestionToast(editingQuestionId ? 'Question mise à jour.' : 'Votre question a été envoyée. Un professeur vous répondra.');
      setActivePanel('video');
      loadMyQuestions();
    } finally {
      setQuestionSending(false);
    }
  };

  const searchMentions = async (qStr) => {
    const query = String(qStr || '').trim();
    if (!query) {
      setMentionCandidates([]);
      return;
    }
    setMentionLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('id,name,role')
        .in('role', ['owner', 'admin', 'teacher', 'secretariat'])
        .ilike('name', `%${query}%`)
        .limit(8);
      if (err) return;
      setMentionCandidates(Array.isArray(data) ? data : []);
    } finally {
      setMentionLoading(false);
    }
  };

  useEffect(() => {
    if (mentionQuery === '') return;
    const t = window.setTimeout(() => searchMentions(mentionQuery), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentionQuery]);

  useEffect(() => {
    if (!activeItem) return;
    if (activeItem?.kind !== 'video') return;
    loadNotes();
    loadMyQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItem?.payload?.id]);

  useEffect(() => {
    // Reset pedagogic progress per video
    if (activeItem?.kind !== 'video') return;
    setVideoDone(false);
    setPresentationDone(false);
    setQuizDone(false);
    setClickedMindmapNodeIds(new Set());
    setMindmapTab('mindmap');
  }, [activeItem?.payload?.id]);

  useEffect(() => {
    // Reset clip UI when switching video
    setQuestionClipStart('');
    setQuestionClipEnd('');
    setClipDuration(null);
    setClipPlayableUrl('');
    clipStopAtRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItem?.payload?.id]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (activeItem?.kind !== 'video') return;
      const v = activeItem?.payload;
      const storagePath = v?.storagePath;
      const url = v?.url || '';

      // Only build a preview URL when we can reliably use <video>.
      if (!storagePath) {
        setClipPlayableUrl(url);
        return;
      }

      try {
        const { data, error: err } = await supabase.storage.from('videos').createSignedUrl(storagePath, 60 * 60);
        if (!alive) return;
        if (err) {
          setClipPlayableUrl(url);
          return;
        }
        setClipPlayableUrl(data?.signedUrl || url);
      } catch {
        if (!alive) return;
        setClipPlayableUrl(url);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [activeItem?.kind, activeItem?.payload]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!effectiveFormationId) return;

      const isUuid = (v) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || '').trim());

      setLoading(true);
      setError(null);
      try {
        if (!isUuid(effectiveFormationId)) {
          if (!alive) return;
          setError("Lien invalide. Identifiant de formation incorrect.");
          return;
        }

        const { data: formationRow, error: formationError } = await withTimeout(
          supabase.from('courses').select('id, title, description, status, cycle, duration_weeks, price_cents, image_url, meta, created_at').eq('id', effectiveFormationId).maybeSingle(),
          10000,
          'Timeout formation'
        );
        if (formationError) throw formationError;

        const role = String(user?.role || 'student').toLowerCase();
        const canViewDraft = ['owner', 'admin', 'teacher', 'creator'].includes(role);
        const status = String(formationRow?.status || 'draft').toLowerCase();
        if (status !== 'published' && !canViewDraft) {
          if (!alive) return;
          setFormation(formationRow || null);
          setModules([]);
          setError("Cette formation n'est pas encore publiée.");
          return;
        }

        if (!canViewDraft) {
          const meta = formationRow?.meta && typeof formationRow.meta === 'object' ? formationRow.meta : {};
          const accessMode = meta.access_mode || meta?.access?.mode || 'free';

          if (accessMode === 'subscription') {
            const hasSubscription = billingStatus === 'active' || (billingStatus === 'past_due' && inGrace);
            if (!hasSubscription) {
              if (!alive) return;
              setFormation(formationRow || null);
              setModules([]);
              setError("Cette formation nécessite un abonnement actif. Va sur l'onglet Tarifs pour t'abonner.");
              return;
            }
          }

          if (accessMode === 'one_time') {
            const { data: enrollmentRows, error: enrollmentError } = await withTimeout(
              supabase
                .from('student_progress')
                .select('id, status')
                .eq('course_id', effectiveFormationId)
                .eq('user_id', user?.id)
                .in('status', ['active', 'approved', 'paid'])
                .limit(1),
              10000,
              'Timeout enrollment'
            );
            if (enrollmentError) throw enrollmentError;
            if (!Array.isArray(enrollmentRows) || enrollmentRows.length === 0) {
              if (!alive) return;
              setFormation(formationRow || null);
              setModules([]);
              setError("Cette formation est en vente individuelle. Merci d'acheter le module pour y acceder.");
              return;
            }
          }
        }

        const structResult = await withTimeout(fetchStructure(effectiveFormationId), 20000, 'Timeout structure');
        if (!structResult) throw new Error('Failed to load structure');
        if (structResult?.error) throw structResult.error;

        const structModules = Array.isArray(structResult?.data) ? structResult.data : [];
        const metaModules = (() => {
          const meta = formationRow?.meta;
          if (Array.isArray(formationRow?.modules)) return formationRow.modules;
          if (meta && Array.isArray(meta.modules)) return meta.modules;
          if (meta && meta.structure && Array.isArray(meta.structure.modules)) return meta.structure.modules;
          return [];
        })();

        if (!alive) return;
        setFormation(formationRow || null);
        setModules(structModules.length > 0 ? structModules : metaModules);
      } catch (err) {
        if (!alive) return;
        setFormation(null);
        setModules([]);
        setError(String(err?.message || err || 'Erreur de chargement'));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
    // NOTE: keep deps minimal to avoid reloading loop due to identity changes in contexts.
  }, [effectiveFormationId, fetchStructure, user?.id, user?.role, billingStatus, inGrace]);

  const m = modules[path.mIdx] || null;
  const w = m?.weeks?.[path.wIdx] || null;
  const d = w?.days?.[path.dIdx] || null;

  function normalizeVideoUrl(type, rawUrl) {
    if (!rawUrl) return '';
    if (type === 'youtube') {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = rawUrl.match(regExp);
      if (match && match[2] && match[2].length === 11) {
        return `https://www.youtube.com/embed/${match[2]}`;
      }
      return rawUrl;
    }
    if (type === 'vimeo') {
      const regExp = /vimeo\.com\/(\d+)/;
      const match = rawUrl.match(regExp);
      if (match && match[1]) {
        return `https://player.vimeo.com/video/${match[1]}`;
      }
      return rawUrl;
    }
    return rawUrl;
  }

  const contentCards = useMemo(() => {
    const m = modules?.[path.mIdx];
    const w = m?.weeks?.[path.wIdx];
    const d = w?.days?.[path.dIdx];
    if (!d) return [];

    const dayVideos = Array.isArray(d?.videos)
      ? d.videos
      : Array.isArray(d?.content?.videos)
        ? d.content.videos
        : [];
    const dayReader = d?.reader || d?.content?.reader || null;
    const dayPowerpointRaw = d?.powerpoint || d?.content?.powerpoint || d?.content?.ppt || null;
    const dayPowerpoint = dayPowerpointRaw || dayReader || null;
    const dayQuiz = d?.quiz || d?.content?.quiz || null;

    const normalizedPowerpoint = dayPowerpoint
      ? {
          ...dayPowerpoint,
          type: dayPowerpoint?.type || (dayPowerpoint?.embedUrl || dayPowerpoint?.gammaUrl ? 'gamma' : 'slides'),
          gammaUrl: dayPowerpoint?.gammaUrl || dayPowerpoint?.embedUrl || dayPowerpoint?.url || dayPowerpoint?.src || '',
        }
      : null;

    const cards = [];
    dayVideos.forEach((v, idx) => {
      const payload = normalizeFormationVideoPayload(v);
      cards.push({
        kind: 'video',
        key: `video-${payload?.id || idx}`,
        title: payload?.title || payload?.name || payload?.label || `Vidéo ${idx + 1}`,
        meta: payload?.type || '',
        payload,
        ctx: {
          mIdx: path.mIdx,
          wIdx: path.wIdx,
          dIdx: path.dIdx,
          moduleId: m?.id || null,
          weekId: w?.id || null,
          dayId: d?.id || null,
          moduleTitle: m?.title || '',
          weekTitle: w?.title || '',
          dayTitle: d?.title || '',
        },
      });
    });
    if (normalizedPowerpoint) {
      cards.push({
        kind: 'support',
        key: `support-${normalizedPowerpoint?.id || '1'}`,
        title: normalizedPowerpoint?.title || normalizedPowerpoint?.name || 'Support',
        meta: normalizedPowerpoint?.type === 'gamma' ? 'Gamma' : 'Slides',
        payload: normalizedPowerpoint,
      });
    }
    if (dayQuiz) {
      cards.push({
        kind: 'quiz',
        key: `quiz-${dayQuiz?.id || '1'}`,
        title: dayQuiz?.title || 'Quiz',
        meta: `${dayQuiz?.questions?.length || 0} questions`,
        payload: dayQuiz,
      });
    }
    return cards;
  }, [modules, path.dIdx, path.mIdx, path.wIdx]);

  const selectSafe = (next) => {
    const nextMIdx = next.mIdx ?? path.mIdx;
    const safeMIdx = Math.max(0, Math.min(nextMIdx, Math.max(0, modules.length - 1)));
    const weeks = modules[safeMIdx]?.weeks || [];
    const nextWIdx = next.wIdx ?? (safeMIdx !== path.mIdx ? 0 : path.wIdx);
    const safeWIdx = Math.max(0, Math.min(nextWIdx, Math.max(0, weeks.length - 1)));
    const days = weeks[safeWIdx]?.days || [];
    const nextDIdx = next.dIdx ?? (safeWIdx !== path.wIdx || safeMIdx !== path.mIdx ? 0 : path.dIdx);
    const safeDIdx = Math.max(0, Math.min(nextDIdx, Math.max(0, days.length - 1)));
    setPath({ mIdx: safeMIdx, wIdx: safeWIdx, dIdx: safeDIdx });
  };

  if (loading) return <div className="min-h-screen bg-[#0F1419] text-white p-10">Chargement…</div>;
  if (error) {
    return (
      <div className="min-h-screen bg-[#0F1419] text-white p-10">
        <div className="max-w-xl space-y-4">
          <div className="text-lg font-semibold">Accès indisponible</div>
          <div className="text-sm text-gray-300">{error}</div>
          <div className="pt-2">
            <Button variant="outline" className="border-white/10 text-white" onClick={() => navigate('/formations')}>
              Retour aux formations
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleExit = () => {
    if (typeof onExit === 'function') {
      onExit();
      return;
    }
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-[#0F1419] text-white flex flex-col relative overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#D4AF37]/6 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-indigo-500/5 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-0 w-[300px] h-[300px] bg-cyan-500/4 rounded-full blur-[80px]" />
      </div>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="h-16 border-b border-white/10 flex items-center px-6 bg-[#151a21]/80 backdrop-blur-xl sticky top-0 z-20"
      >
        <Button variant="ghost" onClick={handleExit} className="text-gray-400 hover:text-white hover:bg-white/5 -ml-2">
          <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Retour
        </Button>
        <div className="flex-1 px-6 min-w-0">
          <h1 className="text-lg font-bold truncate bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">
            {formation?.title || 'Formation'}
          </h1>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
            <Layers className="w-3.5 h-3.5 text-[#D4AF37]/80" />
            <span className="truncate">{m?.title || ''}{w?.title ? ` › ${w.title}` : ''}{d?.title ? ` › ${d.title}` : ''}</span>
          </div>
        </div>
        <Button
          variant="outline"
          className="border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10"
          onClick={() => { if (formationForumBase) navigate(formationForumBase); }}
        >
          Forum
        </Button>
      </motion.header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 max-w-7xl mx-auto w-full">
        {/* Sidebar - Programme */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="lg:col-span-4"
        >
          <div className="rounded-2xl border border-white/10 bg-[#151a21]/80 backdrop-blur-xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              </div>
              <span className="font-bold text-[#D4AF37] uppercase tracking-wider text-sm">Programme</span>
            </div>
            <div className="p-3 max-h-[60vh] overflow-y-auto space-y-2">
              {modules.length === 0 ? (
                <div className="text-sm text-gray-500 py-8 text-center">Aucun contenu.</div>
              ) : null}
              {modules.map((mod, mIdx) => (
                <motion.div
                  key={mod.id || mIdx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: mIdx * 0.03 }}
                  className="space-y-1"
                >
                  <button
                    type="button"
                    onClick={() => selectSafe({ mIdx })}
                    className={cn(
                      'w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3',
                      mIdx === path.mIdx
                        ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] shadow-lg shadow-[#D4AF37]/10'
                        : 'border border-transparent hover:bg-white/5 hover:border-white/10 text-gray-300'
                    )}
                  >
                    <span className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                      mIdx === path.mIdx ? 'bg-[#D4AF37] text-black' : 'bg-white/10 text-gray-400'
                    )}>
                      {mIdx + 1}
                    </span>
                    <span className="font-semibold truncate">{mod.title || `Module ${mIdx + 1}`}</span>
                  </button>

                  <AnimatePresence>
                    {mIdx === path.mIdx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden pl-4 ml-3 border-l border-white/10"
                      >
                        {(mod.weeks || []).map((week, wIdx) => (
                          <div key={week.id || wIdx} className="py-2">
                            <button
                              type="button"
                              onClick={() => selectSafe({ mIdx, wIdx })}
                              className={cn(
                                'w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-2 text-sm',
                                wIdx === path.wIdx ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                              )}
                            >
                              <ChevronRight className={cn('w-4 h-4 transition-transform', wIdx === path.wIdx && 'rotate-90')} />
                              {week.title || `Semaine ${wIdx + 1}`}
                            </button>
                            {wIdx === path.wIdx && (
                              <div className="pl-4 mt-1 space-y-0.5">
                                {(week.days || []).map((day, dIdx) => (
                                  <button
                                    key={day.id || dIdx}
                                    type="button"
                                    onClick={() => selectSafe({ mIdx, wIdx, dIdx })}
                                    className={cn(
                                      'w-full text-left px-3 py-2 rounded-lg transition-all text-sm flex items-center gap-2',
                                      dIdx === path.dIdx
                                        ? 'bg-[#D4AF37]/15 text-[#D4AF37] border-l-2 border-[#D4AF37] -ml-[2px] pl-[14px]'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                    )}
                                  >
                                    <Play className="w-3.5 h-3.5 opacity-70" />
                                    {day.title || `Jour ${dIdx + 1}`}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.aside>

        {/* Content area */}
        <motion.main
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="lg:col-span-8"
        >
          {!d ? (
            <div className="rounded-2xl border border-dashed border-white/20 bg-[#151a21]/40 backdrop-blur p-12 text-center">
              <BookOpen className="w-16 h-16 mx-auto text-gray-600 mb-4" />
              <p className="text-gray-400 font-medium">Sélectionne un jour dans le programme</p>
              <p className="text-sm text-gray-500 mt-1">pour afficher le contenu</p>
            </div>
          ) : (
            <div className="space-y-6">
              <motion.div
                key={`${path.mIdx}-${path.wIdx}-${path.dIdx}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-white/10 bg-[#151a21]/80 backdrop-blur-xl overflow-hidden"
              >
                <div className="p-6 border-b border-white/10 bg-gradient-to-r from-[#D4AF37]/10 to-transparent">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/20 flex items-center justify-center">
                      <Layers className="w-5 h-5 text-[#D4AF37]" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">{d.title}</h2>
                      <p className="text-sm text-gray-400">{m?.title} · {w?.title}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Video className="w-4 h-4 text-[#D4AF37]" />
                    <span className="text-sm font-semibold text-[#D4AF37] uppercase tracking-wider">Contenu du jour</span>
                  </div>
                  {contentCards.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 rounded-xl border border-dashed border-white/10">
                      Aucun contenu pour ce jour.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {contentCards.map((c, idx) => {
                        const Icon = c.kind === 'video' ? Video : c.kind === 'support' ? Presentation : FileText;
                        return (
                          <motion.button
                            key={c.key}
                            type="button"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setActiveItem(c)}
                            className="group text-left rounded-xl border border-white/10 bg-white/[0.02] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/40 p-5 transition-all duration-300 flex items-start gap-4"
                          >
                            <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/20 flex items-center justify-center shrink-0 group-hover:bg-[#D4AF37]/30 transition-colors">
                              <Icon className="w-6 h-6 text-[#D4AF37]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-white truncate group-hover:text-[#D4AF37] transition-colors">{c.title}</div>
                              <div className="text-xs text-gray-500 mt-0.5">{c.meta}</div>
                            </div>
                            <div className="shrink-0 flex items-center gap-1 text-xs text-gray-500 group-hover:text-[#D4AF37] transition-colors">
                              <span>Ouvrir</span>
                              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </motion.main>
      </div>

      <Dialog open={!!activeItem} onOpenChange={(open) => { if (!open) setActiveItem(null); }}>
        <DialogContent className="max-w-[98vw] w-full h-[92vh] bg-[#0F1419] border border-white/10 p-0 overflow-hidden text-white [&>button]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Lecteur de cours</DialogTitle>
          </DialogHeader>
          {activeItem?.kind === 'video' ? (() => {
            const formationId = formationKey || 'formation';
            const playlistData = [
              {
                id: formationId,
                title: formation?.title || 'Formation',
                description: formation?.description || '',
                progress: 0,
                modules: (modules || []).map((mod, mIdx) => ({
                  id: mod?.id || `mod-${mIdx}`,
                  title: mod?.title || `Module ${mIdx + 1}`,
                  progress: 0,
                  weeks: (mod?.weeks || []).map((week, wIdx) => ({
                    id: week?.id || `wk-${mIdx}-${wIdx}`,
                    title: week?.title || `Semaine ${wIdx + 1}`,
                    progress: 0,
                    days: (week?.days || []).map((day, dIdx) => {
                      const dayVideos = Array.isArray(day?.videos)
                        ? day.videos
                        : Array.isArray(day?.content?.videos)
                          ? day.content.videos
                          : [];
                      return {
                        id: day?.id || `day-${mIdx}-${wIdx}-${dIdx}`,
                        title: day?.title || `Jour ${dIdx + 1}`,
                        progress: 0,
                        videos: dayVideos.map((v, vIdx) => ({
                          ...v,
                          id: v?.id || `vid-${mIdx}-${wIdx}-${dIdx}-${vIdx}`,
                          title: v?.title || v?.name || v?.label || `Vidéo ${vIdx + 1}`,
                          url: normalizeVideoUrl(v?.type, v?.url),
                          duration: Number.isFinite(Number(v?.duration)) ? Number(v.duration) : 600,
                          thumbnail: v?.thumbnail || '',
                          status: 'unwatched',
                          progress: 0,
                        })),
                      };
                    }),
                  })),
                })),
              },
            ];

            const { d: ctxDay } = deriveCtxFromActiveItem();
            const currentDayPowerpoint = ctxDay?.powerpoint || ctxDay?.reader || null;
            const currentDayQuiz = ctxDay?.quiz || null;

            const canShowPresentation = !!currentDayPowerpoint;
            const canShowQuiz = !!currentDayQuiz;

            const questionsUnlocked = videoDone
              && (!canShowPresentation || presentationDone)
              && (!canShowQuiz || quizDone)
              && notesFilled;

            const getQuestionsLockedReason = () => {
              if (!videoDone) return 'Termine la vidéo pour débloquer les questions.';
              if (canShowPresentation && !presentationDone) return "Va jusqu'au dernier slide de la présentation.";
              if (canShowQuiz && !quizDone) return 'Termine le quiz pour continuer.';
              if (!notesFilled) {
                const missing = Math.max(0, 100 - notesWordCount);
                return `Remplis ton cahier (minimum 100 mots). Il manque ${missing} mot${missing > 1 ? 's' : ''}.`;
              }
              return '';
            };

            const handleVideoEnded = () => {
              setVideoDone(true);
              if (canShowPresentation) setActivePanel('presentation');
              else if (canShowQuiz) setActivePanel('quiz');
              else setActivePanel('notes');
            };

            return (
              <div className="h-full bg-[#0F1419] text-white flex flex-col overflow-hidden">
                <header className="h-16 bg-[#151a21]/95 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-4 md:px-6 shrink-0 z-20">
                  <div className="flex items-center gap-4 min-w-0">
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="md:hidden text-[#D4AF37]">
                          <Menu className="w-6 h-6" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="left" className="p-0 bg-[#192734] border-r border-white/10 w-[85%] sm:w-[350px]">
                        <ProgressivePlaylist
                          playlistData={playlistData}
                          currentFormationId={formationId}
                          currentModuleId={activeItem?.ctx?.moduleId}
                          currentWeekId={activeItem?.ctx?.weekId}
                          currentDayId={activeItem?.ctx?.dayId}
                          currentVideoId={activeItem?.payload?.id}
                          onVideoSelect={(v, dayId, weekId, moduleId) => {
                            const mIdx = (modules || []).findIndex((mm) => mm?.id === moduleId);
                            const wIdx = mIdx >= 0 ? ((modules[mIdx]?.weeks || []).findIndex((ww) => ww?.id === weekId)) : -1;
                            const dIdx = mIdx >= 0 && wIdx >= 0 ? ((modules[mIdx]?.weeks?.[wIdx]?.days || []).findIndex((dd) => dd?.id === dayId)) : -1;
                            if (mIdx >= 0 && wIdx >= 0 && dIdx >= 0) {
                              selectSafe({ mIdx, wIdx, dIdx });
                              const mm = modules[mIdx];
                              const ww = mm?.weeks?.[wIdx];
                              const dd = ww?.days?.[dIdx];
                              setActiveItem({
                                kind: 'video',
                                key: `video-${v?.id || 'x'}`,
                                title: v?.title || 'Vidéo',
                                meta: v?.type || '',
                                payload: v,
                                ctx: {
                                  mIdx,
                                  wIdx,
                                  dIdx,
                                  moduleId: moduleId || mm?.id || null,
                                  weekId: weekId || ww?.id || null,
                                  dayId: dayId || dd?.id || null,
                                  moduleTitle: mm?.title || '',
                                  weekTitle: ww?.title || '',
                                  dayTitle: dd?.title || '',
                                },
                              });
                            }
                          }}
                        />
                      </SheetContent>
                    </Sheet>

                    <div className="min-w-0">
                      <h1 className="font-bold text-sm md:text-lg leading-tight truncate max-w-[220px] md:max-w-md">{activeItem?.title || 'Vidéo'}</h1>
                      <p className="text-[10px] md:text-sm text-gray-400 truncate max-w-[260px] md:max-w-xl">
                        {activeItem?.ctx?.moduleTitle ? activeItem.ctx.moduleTitle : ''}
                        {activeItem?.ctx?.weekTitle ? ` • ${activeItem.ctx.weekTitle}` : ''}
                        {activeItem?.ctx?.dayTitle ? ` • ${activeItem.ctx.dayTitle}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!formationForumBase) return;
                        navigate(formationForumBase);
                      }}
                      className="md:hidden border-white/10 text-white hover:bg-white/5 font-bold text-xs h-8"
                    >
                      Forum
                    </Button>

                    <div className="hidden md:flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!formationForumBase) return;
                        navigate(formationForumBase);
                      }}
                      className="border-white/10 text-white hover:bg-white/5 font-bold text-xs h-8"
                    >
                      Forum
                    </Button>
                    <Button variant="outline" onClick={() => setActiveItem(null)} className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black font-bold text-xs h-8">
                      Fermer
                    </Button>
                    </div>
                  </div>
                </header>

                <div className="flex-1 flex overflow-hidden relative">
                  <div className="flex-1 flex flex-col overflow-y-auto bg-[#0F1419]">
                    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
                      {activePanel === 'video' ? (
                        <div className="space-y-6">
                          <VideoPlayer ref={videoPlayerRef} video={currentVideoMemo} onEnded={handleVideoEnded} onTimeUpdate={setVideoCurrentTime} />
                          <div className="flex items-center justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              className={
                                liked
                                  ? 'border-[#D4AF37] text-[#D4AF37] hover:bg-white/5 font-bold'
                                  : 'border-white/10 text-white hover:bg-white/5 font-bold'
                              }
                              onClick={() => setLiked((v) => !v)}
                            >
                              <Heart className={liked ? 'w-4 h-4 mr-2 fill-current' : 'w-4 h-4 mr-2'} />
                              Like
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="lg:col-span-2 border border-white/10 rounded-xl bg-[#151a21]/60 backdrop-blur p-5">
                              <div className="text-xs text-[#D4AF37] uppercase tracking-wider font-semibold mb-2">Résumé</div>
                              <div className="text-sm text-gray-200 whitespace-pre-wrap mt-2">
                                {String(currentVideoMemo?.summary || currentVideoMemo?.description || '').trim() || '—'}
                              </div>
                            </div>
                            <div className="border border-white/10 rounded-xl bg-[#151a21]/60 backdrop-blur p-5">
                              <div className="text-xs text-[#D4AF37] uppercase tracking-wider font-semibold mb-2">Points clés</div>
                              <div className="text-sm text-gray-200 whitespace-pre-wrap mt-2">
                                {String(currentVideoMemo?.keyPoints || '').trim() || '—'}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="border border-white/10 rounded-xl bg-[#151a21]/60 backdrop-blur p-5">
                              <ChapterList
                                timestamps={Array.isArray(currentVideoMemo?.timestamps) ? currentVideoMemo.timestamps : []}
                                currentTimeSeconds={videoCurrentTime}
                                onSeek={seekVideoTo}
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <div className="border border-white/10 rounded-xl bg-white/5 px-3 py-2">
                              <TranscriptPanel
                                transcript={Array.isArray(currentVideoMemo?.transcript) ? currentVideoMemo.transcript : []}
                                currentTimeSeconds={videoCurrentTime}
                                onSeek={seekVideoTo}
                                buttonOnly
                              />
                            </div>
                            {
                              (() => {
                                const mindmapData = currentVideoMemo?.mindmap || null;
                                const hasMindmap = !!mindmapData;
                                const countNodes = (n) => n ? 1 + (n.children || []).reduce((s, c) => s + countNodes(c), 0) : 0;
                                const totalNodes = countNodes(mindmapData);
                                const allNodesClicked = totalNodes > 0 && clickedMindmapNodeIds.size >= totalNodes;
                                const mindmapUnlocked = videoDone && hasMindmap;
                                return (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    disabled={!mindmapUnlocked}
                                    title={!mindmapUnlocked ? (!videoDone ? 'Termine la vidéo pour accéder à la salle de révision' : 'Aucune mindmap disponible') : undefined}
                                    className={mindmapUnlocked
                                      ? 'border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10 font-bold gap-2'
                                      : 'border-white/10 text-gray-500 cursor-not-allowed opacity-50 gap-2'
                                    }
                                    onClick={() => { if (mindmapUnlocked) { setMindmapTab('mindmap'); setMindmapOpen(true); } }}
                                  >
                                    {mindmapUnlocked ? '🎓' : '🔒'}
                                    Salle de révision et approfondissement
                                    {mindmapUnlocked && allNodesClicked && (
                                      <span className="ml-1 text-[10px] bg-green-500/20 text-green-300 border border-green-500/30 rounded-full px-2 py-0.5">Quiz dispo</span>
                                    )}
                                  </Button>
                                );
                              })()
                            }

                            {mindmapOpen ? (
                              <div className="fixed inset-0 z-[80]">
                                <div
                                  className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
                                  onClick={() => {
                                    if (!mindmapMinimized) setMindmapOpen(false);
                                  }}
                                />

                                {mindmapMinimized ? (
                                  <div className="absolute bottom-4 right-4">
                                    <div className="bg-[#0F1419]/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur px-3 py-2 flex items-center gap-2">
                                      <div className="text-xs text-gray-200 font-semibold">Mindmap</div>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="h-7 px-2 border-white/10 text-white hover:bg-white/5"
                                        onClick={() => setMindmapMinimized(false)}
                                      >
                                        Ouvrir
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="h-7 px-2 border-white/10 text-white hover:bg-white/5"
                                        onClick={() => {
                                          setMindmapMinimized(false);
                                          setMindmapOpen(false);
                                        }}
                                      >
                                        Fermer
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="absolute inset-0 flex items-end md:items-center justify-center p-3 md:p-6">
                                    <div className="w-[98vw] md:w-[1100px] h-[82vh] bg-[#0F1419]/95 border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur">
                                      {(() => {
                                        const mindmapData = currentVideoMemo?.mindmap || null;
                                        const countNodes = (n) => n ? 1 + (n.children || []).reduce((s, c) => s + countNodes(c), 0) : 0;
                                        const totalNodes = countNodes(mindmapData);
                                        const quizThreshold = totalNodes > 0 ? Math.max(1, Math.ceil(totalNodes * 0.5)) : 0;
                                        const allNodesClicked = quizThreshold > 0 && clickedMindmapNodeIds.size >= quizThreshold;
                                        return (
                                          <>
                                            <div className="h-12 px-3 flex items-center justify-between border-b border-white/10 bg-black/30">
                                              <div className="flex items-center gap-1">
                                                <button
                                                  type="button"
                                                  onClick={() => setMindmapTab('mindmap')}
                                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                                    mindmapTab === 'mindmap'
                                                      ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30'
                                                      : 'text-gray-400 hover:text-white'
                                                  }`}
                                                >
                                                  🗺️ Mindmap
                                                  {totalNodes > 0 && (
                                                    <span className="ml-1.5 text-[10px] opacity-70">{clickedMindmapNodeIds.size}/{quizThreshold}</span>
                                                  )}
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => allNodesClicked && setMindmapTab('quiz')}
                                                  title={!allNodesClicked ? 'Explore tous les nœuds pour débloquer le quiz' : undefined}
                                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                                    !allNodesClicked
                                                      ? 'text-gray-600 cursor-not-allowed'
                                                      : mindmapTab === 'quiz'
                                                      ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                                      : 'text-gray-400 hover:text-white'
                                                  }`}
                                                >
                                                  {allNodesClicked ? '🏆' : '🔒'} Quiz
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setMindmapTab('question')}
                                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                                    mindmapTab === 'question'
                                                      ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                                                      : 'text-gray-400 hover:text-white'
                                                  }`}
                                                >
                                                  💬 Question
                                                </button>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <Button type="button" variant="outline" className="h-8 border-white/10 text-white hover:bg-white/5" onClick={() => setMindmapMinimized(true)}>Réduire</Button>
                                                <Button type="button" variant="outline" className="h-8 border-white/10 text-white hover:bg-white/5" onClick={() => { setMindmapMinimized(false); setMindmapOpen(false); }}>Fermer</Button>
                                              </div>
                                            </div>
                                            {mindmapTab === 'mindmap' && (
                                              <div className="flex h-[calc(82vh-3rem)] overflow-hidden">
                                                <div className="flex-1 min-w-0 p-3">
                                                  <MindMapNavigation
                                                    key="mindmap-player"
                                                    mindmap={mindmapData}
                                                    onSeek={seekVideoTo}
                                                    onRawNodeClick={(nodeId) => setClickedMindmapNodeIds(prev => new Set([...prev, nodeId]))}
                                                    onSelectNode={(n) => {
                                                      setSelectedMindmapPlayerNode(n);
                                                      setClickedMindmapNodeIds(prev => new Set([...prev, n.id]));
                                                    }}
                                                    selectedNodeId={selectedMindmapPlayerNode?.id || null}
                                                    heightClassName="h-[calc(82vh-5rem)]"
                                                    clickedNodeIds={clickedMindmapNodeIds}
                                                  />
                                                </div>
                                                <div
                                                  className="flex-shrink-0 overflow-hidden"
                                                  style={{ width: selectedMindmapPlayerNode ? '380px' : '0px', transition: 'width 0.32s cubic-bezier(0.4,0,0.2,1)' }}
                                                >
                                                  <AnimatePresence mode="wait">
                                                    {selectedMindmapPlayerNode && (
                                                      <NodeExplanationPanel
                                                        key={selectedMindmapPlayerNode.id}
                                                        node={selectedMindmapPlayerNode}
                                                        videoTitle={currentVideoMemo?.title || currentVideoMemo?.data?.title || ''}
                                                        transcript={Array.isArray(currentVideoMemo?.transcript) ? currentVideoMemo.transcript : []}
                                                        onSeek={(t) => { seekVideoTo(t); setMindmapOpen(false); setMindmapMinimized(false); setSelectedMindmapPlayerNode(null); }}
                                                        onClose={() => setSelectedMindmapPlayerNode(null)}
                                                        onSelectNode={(n) => setSelectedMindmapPlayerNode(n)}
                                                      />
                                                    )}
                                                  </AnimatePresence>
                                                </div>
                                              </div>
                                            )}
                                            {mindmapTab === 'quiz' && (
                                              <div className="h-[calc(82vh-3rem)] overflow-hidden">
                                                <QuizPanel
                                                  nodes={mindmapData ? [mindmapData] : []}
                                                  videoTitle={currentVideoMemo?.title || currentVideoMemo?.data?.title || ''}
                                                  unlocked={allNodesClicked}
                                                />
                                              </div>
                                            )}
                                            {mindmapTab === 'question' && (
                                              <div className="h-[calc(82vh-3rem)] flex flex-col overflow-hidden">
                                                {/* Sub-tab bar */}
                                                <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2 border-b border-white/10 bg-black/20">
                                                  <button
                                                    type="button"
                                                    onClick={() => setQuestionsSubTab('ia')}
                                                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                                      questionsSubTab === 'ia'
                                                        ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                                                        : 'text-gray-400 hover:text-white'
                                                    }`}
                                                  >
                                                    🤖 IA · ProraScience
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => setQuestionsSubTab('manual')}
                                                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                                      questionsSubTab === 'manual'
                                                        ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30'
                                                        : 'text-gray-400 hover:text-white'
                                                    }`}
                                                  >
                                                    ✍️ Manikongo
                                                  </button>
                                                </div>

                                                {/* IA sub-tab */}
                                                {questionsSubTab === 'ia' && (
                                                  <div className="flex-1 overflow-hidden">
                                                    <QuestionPanel
                                                      videoTitle={currentVideoMemo?.title || currentVideoMemo?.data?.title || ''}
                                                      transcript={Array.isArray(currentVideoMemo?.transcript) ? currentVideoMemo.transcript : []}
                                                      mindmap={mindmapData}
                                                      videoUrl={currentVideoMemo?.url || currentVideoMemo?.data?.url || ''}
                                                      onSwitchToManual={(prefill) => {
                                                        setQuestionsSubTab('manual');
                                                        if (prefill) setQuestionText(prefill);
                                                      }}
                                                    />
                                                  </div>
                                                )}

                                                {/* Manikongo sub-tab — moteur complet */}
                                                {questionsSubTab === 'manual' && (
                                                  <div className="flex-1 overflow-y-auto">
                                                    <div className="border border-white/10 rounded-xl bg-white/5 p-5 space-y-3 m-3">
                                                      <div className="font-bold text-[#D4AF37]">✍️ Poser une question à Manikongo</div>
                                                      <div className="text-sm text-gray-300">
                                                        Pose ta question sur cette leçon. Tu peux la rendre publique (visible dans le forum du cours) ou privée (uniquement pour l&apos;équipe enseignante).

                                                        {currentVideoMemo?.storagePath ? (
                                                          <div className="mt-3 space-y-3">
                                                            <div className="border border-white/10 rounded-lg overflow-hidden bg-black">
                                                              <video
                                                                ref={clipVideoRef}
                                                                src={clipPlayableUrl || ''}
                                                                className="w-full aspect-video"
                                                                controls
                                                                onLoadedMetadata={(e) => {
                                                                  const dur = Number(e?.currentTarget?.duration);
                                                                  if (Number.isFinite(dur) && dur > 0) setClipDuration(dur);
                                                                }}
                                                                onTimeUpdate={(e) => {
                                                                  const stopAt = clipStopAtRef.current;
                                                                  if (stopAt == null) return;
                                                                  const t = Number(e?.currentTarget?.currentTime);
                                                                  if (Number.isFinite(t) && t >= stopAt - 0.05) {
                                                                    e.currentTarget.pause();
                                                                    clipStopAtRef.current = null;
                                                                  }
                                                                }}
                                                              />
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                              <Button size="sm" variant="outline" className="border-white/10 text-white hover:bg-white/5"
                                                                onClick={() => {
                                                                  const t = clipVideoRef.current ? Number(clipVideoRef.current.currentTime || 0) : 0;
                                                                  setClipStartSafe(Math.round(Math.max(0, t) * 2) / 2);
                                                                }}>
                                                                Définir IN
                                                              </Button>
                                                              <Button size="sm" variant="outline" className="border-white/10 text-white hover:bg-white/5"
                                                                onClick={() => {
                                                                  const t = clipVideoRef.current ? Number(clipVideoRef.current.currentTime || 0) : 0;
                                                                  setClipEndSafe(Math.round(Math.max(0, t) * 2) / 2);
                                                                }}>
                                                                Définir OUT
                                                              </Button>
                                                              <Button size="sm" className="bg-[#D4AF37] text-black hover:bg-yellow-500 font-bold"
                                                                disabled={!clipVideoRef.current || questionClipStart === '' || questionClipEnd === ''}
                                                                onClick={() => {
                                                                  if (!clipVideoRef.current) return;
                                                                  const start = Number(questionClipStart);
                                                                  const end = Number(questionClipEnd);
                                                                  if (!Number.isFinite(start) || !Number.isFinite(end)) return;
                                                                  const s = Math.max(0, Math.min(start, end));
                                                                  const e = Math.max(0, Math.max(start, end));
                                                                  clipVideoRef.current.currentTime = s;
                                                                  clipStopAtRef.current = e;
                                                                  clipVideoRef.current.play();
                                                                }}>
                                                                Lire le clip
                                                              </Button>
                                                            </div>
                                                            {clipDuration != null ? (
                                                              <div className="space-y-2">
                                                                <div className="text-xs text-gray-400">Navigation visuelle</div>
                                                                <div className="grid grid-cols-1 gap-2">
                                                                  <input type="range" min="0" max={Math.floor(clipDuration)} step="0.5"
                                                                    value={questionClipStart === '' ? 0 : Number(questionClipStart)}
                                                                    onChange={(e) => setClipStartSafe(e.target.value)} />
                                                                  <input type="range" min="0" max={Math.floor(clipDuration)} step="0.5"
                                                                    value={questionClipEnd === '' ? Math.floor(clipDuration) : Number(questionClipEnd)}
                                                                    onChange={(e) => setClipEndSafe(e.target.value)} />
                                                                </div>
                                                              </div>
                                                            ) : null}
                                                          </div>
                                                        ) : (
                                                          <div className="mt-3 text-xs text-gray-400">
                                                            La sélection visuelle IN/OUT est disponible pour les vidéos uploadées (lecteur HTML5). Pour YouTube/Vimeo, utilise les champs ci-dessous.
                                                          </div>
                                                        )}
                                                      </div>

                                                      <div className="text-xs text-gray-400">
                                                        {questionStatus === 'loading' ? 'Envoi…'
                                                          : questionStatus === 'error' ? "Erreur: impossible d'envoyer la question."
                                                          : questionStatus === 'sent' ? 'Question envoyée.'
                                                          : ''}
                                                      </div>

                                                      <div className="flex items-center gap-3">
                                                        <label className="text-sm text-gray-300 flex items-center gap-2">
                                                          <input type="radio" name="question_visibility_modal" checked={questionIsPublic} onChange={() => setQuestionIsPublic(true)} />
                                                          Publique
                                                        </label>
                                                        <label className="text-sm text-gray-300 flex items-center gap-2">
                                                          <input type="radio" name="question_visibility_modal" checked={!questionIsPublic} onChange={() => setQuestionIsPublic(false)} />
                                                          Privée
                                                        </label>
                                                      </div>

                                                      <div className="border border-white/10 rounded-lg p-3 bg-black/20">
                                                        <div className="text-xs text-gray-400 uppercase tracking-wider">Séquence (clip)</div>
                                                        <div className="text-sm text-gray-300 mt-1">Référence une séquence de la vidéo (en secondes). Optionnel.</div>
                                                        <div className="grid grid-cols-2 gap-3 mt-3">
                                                          <div className="space-y-1">
                                                            <div className="text-xs text-gray-400">Début (s)</div>
                                                            <input type="number" min="0" step="0.5" value={questionClipStart} onChange={(e) => setClipStartSafe(e.target.value)}
                                                              className="w-full px-3 py-2 rounded bg-[#0F1419] border border-white/10 text-white" placeholder="ex: 12" />
                                                          </div>
                                                          <div className="space-y-1">
                                                            <div className="text-xs text-gray-400">Fin (s)</div>
                                                            <input type="number" min="0" step="0.5" value={questionClipEnd} onChange={(e) => setClipEndSafe(e.target.value)}
                                                              className="w-full px-3 py-2 rounded bg-[#0F1419] border border-white/10 text-white" placeholder="ex: 32" />
                                                          </div>
                                                        </div>
                                                      </div>

                                                      <Textarea
                                                        value={questionText}
                                                        onChange={(e) => {
                                                          const next = e.target.value;
                                                          setQuestionText(next);
                                                          const m = /(^|\s)@([\p{L}0-9_\-]{0,32})$/iu.exec(next);
                                                          if (m) { setMentionQuery(m[2] || ''); }
                                                          else { setMentionQuery(''); setMentionCandidates([]); }
                                                        }}
                                                        className="bg-[#0F1419] border-white/10 min-h-[180px] text-white"
                                                        placeholder="Écris ta question ici..."
                                                      />

                                                      {selectedMentions.length > 0 ? (
                                                        <div className="flex flex-wrap gap-2">
                                                          {selectedMentions.map((m) => (
                                                            <button key={m.id} type="button"
                                                              onClick={() => setSelectedMentions((prev) => prev.filter((x) => x.id !== m.id))}
                                                              className="px-2 py-1 rounded bg-white/10 border border-white/10 text-xs text-white hover:bg-white/15"
                                                              title="Cliquer pour retirer">
                                                              @{m.name}
                                                            </button>
                                                          ))}
                                                        </div>
                                                      ) : null}

                                                      {mentionQuery !== '' ? (
                                                        <div className="border border-white/10 rounded-lg bg-[#0F1419] overflow-hidden">
                                                          <div className="px-3 py-2 text-xs text-gray-400 border-b border-white/10">Mentionner un prof / admin</div>
                                                          {mentionLoading ? (
                                                            <div className="px-3 py-2 text-sm text-gray-400">Recherche…</div>
                                                          ) : mentionCandidates.length === 0 ? (
                                                            <div className="px-3 py-2 text-sm text-gray-400">Aucun résultat</div>
                                                          ) : (
                                                            <div className="max-h-[180px] overflow-y-auto">
                                                              {mentionCandidates.map((c) => (
                                                                <button key={c.id} type="button"
                                                                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between"
                                                                  onClick={() => {
                                                                    setSelectedMentions((prev) => { if (prev.some((x) => x.id === c.id)) return prev; return [...prev, c]; });
                                                                    setQuestionText((prev) => prev.replace(/(^|\s)@([\p{L}0-9_\-]{0,32})$/iu, `$1@${c.name} `));
                                                                    setMentionQuery(''); setMentionCandidates([]);
                                                                  }}>
                                                                  <div className="text-sm text-white">{c.name}</div>
                                                                  <div className="text-[10px] text-gray-400">{c.role}</div>
                                                                </button>
                                                              ))}
                                                            </div>
                                                          )}
                                                        </div>
                                                      ) : null}

                                                      <div className="border border-white/10 rounded-lg p-3 bg-black/20">
                                                        <div className="text-xs text-gray-400 uppercase tracking-wider">Mes questions sur cette vidéo</div>
                                                        {myQuestionsLoading ? (
                                                          <div className="text-sm text-gray-400 mt-2">Chargement…</div>
                                                        ) : myQuestions.length === 0 ? (
                                                          <div className="text-sm text-gray-400 mt-2">Aucune question pour l&apos;instant.</div>
                                                        ) : (
                                                          <div className="mt-3 space-y-2">
                                                            {myQuestions.map((q) => {
                                                              const editable = canEditQuestion(q.created_at);
                                                              const shareUrl = formationForumBase ? `${window.location.origin}${formationForumBase}?questionId=${q.id}` : '';
                                                              return (
                                                                <div key={q.id} className="border border-white/10 rounded-lg p-3 bg-[#0F1419]">
                                                                  <div className="text-xs text-gray-500">{new Date(q.created_at).toLocaleString()}</div>
                                                                  <div className="text-sm text-gray-200 whitespace-pre-wrap mt-1">{q.question}</div>
                                                                  <div className="text-xs text-gray-400 mt-1">Séquence: {q.clip_start_seconds ?? '—'}s → {q.clip_end_seconds ?? '—'}s</div>
                                                                  <div className="flex flex-wrap items-center justify-end gap-2 mt-3">
                                                                    <Button size="sm" variant="outline" className="border-white/10 text-white hover:bg-white/5"
                                                                      onClick={async () => { if (!shareUrl) return; try { await navigator.clipboard.writeText(shareUrl); setQuestionToast('Lien copié.'); } catch { setQuestionToast('Impossible de copier.'); } }}>
                                                                      Partager
                                                                    </Button>
                                                                    <Button size="sm" variant="outline" className="border-white/10 text-white hover:bg-white/5" disabled={!editable}
                                                                      onClick={() => { setEditingQuestionId(q.id); setEditingCreatedAt(q.created_at); setQuestionText(q.question || ''); setQuestionIsPublic(!!q.is_public); setClipStartSafe(q.clip_start_seconds ?? ''); setClipEndSafe(q.clip_end_seconds ?? ''); }}>
                                                                      Modifier (15 min)
                                                                    </Button>
                                                                    <Button size="sm" variant="outline" className="border-red-500/30 text-red-200 hover:bg-red-500/10" disabled={!editable}
                                                                      onClick={async () => { if (!editable) return; const { error: err } = await supabase.from('formation_student_questions').delete().eq('id', q.id).eq('student_id', user.id); if (!err) { setQuestionToast('Question supprimée.'); loadMyQuestions(); } }}>
                                                                      Supprimer
                                                                    </Button>
                                                                  </div>
                                                                </div>
                                                              );
                                                            })}
                                                          </div>
                                                        )}
                                                      </div>

                                                      <div className="flex items-center justify-end gap-2">
                                                        <Button variant="outline" onClick={() => setQuestionsSubTab('ia')}
                                                          className="border-white/10 text-white hover:bg-white/5">
                                                          ← Retour IA
                                                        </Button>
                                                        <Button onClick={submitQuestion}
                                                          disabled={questionSending || !String(questionText || '').trim()}
                                                          className="bg-[#D4AF37] text-black hover:bg-yellow-500 font-bold">
                                                          {questionSending ? 'Envoi...' : editingQuestionId ? 'Enregistrer' : 'Envoyer à Manikongo'}
                                                        </Button>
                                                      </div>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {activePanel === 'presentation' ? (
                        <PowerPointViewer
                          powerpoint={currentDayPowerpoint}
                          onComplete={() => {
                            setPresentationDone(true);
                            if (canShowQuiz) setActivePanel('quiz');
                            else setActivePanel('notes');
                          }}
                        />
                      ) : null}

                      {activePanel === 'quiz' ? (
                        <QuizPlayerInterface
                          quiz={currentDayQuiz}
                          onCancel={() => setActivePanel('video')}
                          onComplete={() => {
                            setQuizDone(true);
                            setActivePanel('notes');
                          }}
                        />
                      ) : null}

                      {activePanel === 'notes' ? (
                        <div className="max-w-3xl mx-auto">
                          <div className="border border-white/10 rounded-xl bg-white/5 p-5 space-y-3">
                            <div className="font-bold">Cahier de notes</div>
                            <div className="text-sm text-gray-300">Qu'est-ce que tu as retenu ? Écris avec tes mots.</div>
                            <div className="text-xs text-gray-400">
                              {notesStatus === 'loading'
                                ? 'Chargement / enregistrement…'
                                : notesStatus === 'error'
                                  ? "Erreur: la note n'a pas pu être enregistrée."
                                  : notesStatus === 'saved'
                                    ? notesLastSavedAt
                                      ? `Enregistré (${notesLastSavedAt.toLocaleString()})`
                                      : 'Enregistré'
                                    : ''}
                            </div>
                            <div className={notesWordCount >= 100 ? 'text-xs text-green-400' : 'text-xs text-gray-400'}>
                              {notesWordCount}/100 mots
                            </div>
                            <Textarea
                              value={notesText}
                              onChange={(e) => setNotesText(e.target.value)}
                              className="bg-[#0F1419] border-white/10 min-h-[220px] text-white"
                              placeholder="Écris ici..."
                            />
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                onClick={() => setActivePanel('video')}
                                className="border-white/10 text-white hover:bg-white/5"
                              >
                                Retour
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  if (!questionsUnlocked) {
                                    setQuestionToast(getQuestionsLockedReason());
                                    return;
                                  }
                                  setActivePanel('questions');
                                }}
                                disabled={!questionsUnlocked}
                                className={
                                  questionsUnlocked
                                    ? 'border-white/10 text-white hover:bg-white/5'
                                    : 'border-white/10 text-white/40 opacity-60 cursor-not-allowed'
                                }
                              >
                                J'ai une question
                              </Button>
                              <Button
                                onClick={saveNotes}
                                disabled={notesSaving}
                                className="bg-[#D4AF37] text-black hover:bg-yellow-500 font-bold"
                              >
                                {notesSaving ? 'Enregistrement...' : 'Enregistrer'}
                              </Button>
                            </div>
                          </div>

                          {currentVideoMemo?.id ? (
                            <div className="mt-4">
                              <NotesPanel
                                lessonId={currentVideoMemo.id}
                                currentTimeSeconds={videoCurrentTime}
                                onSeek={seekVideoTo}
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {activePanel === 'questions' ? (
                        <div className="max-w-3xl mx-auto">
                          <div className="border border-white/10 rounded-xl bg-white/5 p-5 space-y-3">
                            <div className="font-bold">Poser une question</div>
                            <div className="text-sm text-gray-300">
                              Pose ta question sur cette leçon. Tu peux la rendre publique (visible dans le forum du cours) ou privée (uniquement pour l'équipe enseignante).

                              {currentVideoMemo?.storagePath ? (
                                <div className="mt-3 space-y-3">
                                  <div className="border border-white/10 rounded-lg overflow-hidden bg-black">
                                    <video
                                      ref={clipVideoRef}
                                      src={clipPlayableUrl || ''}
                                      className="w-full aspect-video"
                                      controls
                                      onLoadedMetadata={(e) => {
                                        const dur = Number(e?.currentTarget?.duration);
                                        if (Number.isFinite(dur) && dur > 0) setClipDuration(dur);
                                      }}
                                      onTimeUpdate={(e) => {
                                        const stopAt = clipStopAtRef.current;
                                        if (stopAt == null) return;
                                        const t = Number(e?.currentTarget?.currentTime);
                                        if (Number.isFinite(t) && t >= stopAt - 0.05) {
                                          e.currentTarget.pause();
                                          clipStopAtRef.current = null;
                                        }
                                      }}
                                    />
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-white/10 text-white hover:bg-white/5"
                                      onClick={() => {
                                        const t = clipVideoRef.current ? Number(clipVideoRef.current.currentTime || 0) : 0;
                                        const v = Math.round(Math.max(0, t) * 2) / 2;
                                        setClipStartSafe(v);
                                      }}
                                    >
                                      Définir IN
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-white/10 text-white hover:bg-white/5"
                                      onClick={() => {
                                        const t = clipVideoRef.current ? Number(clipVideoRef.current.currentTime || 0) : 0;
                                        const v = Math.round(Math.max(0, t) * 2) / 2;
                                        setClipEndSafe(v);
                                      }}
                                    >
                                      Définir OUT
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="bg-[#D4AF37] text-black hover:bg-yellow-500 font-bold"
                                      disabled={!clipVideoRef.current || questionClipStart === '' || questionClipEnd === ''}
                                      onClick={() => {
                                        if (!clipVideoRef.current) return;
                                        const start = Number(questionClipStart);
                                        const end = Number(questionClipEnd);
                                        if (!Number.isFinite(start) || !Number.isFinite(end)) return;
                                        const s = Math.max(0, Math.min(start, end));
                                        const e = Math.max(0, Math.max(start, end));
                                        clipVideoRef.current.currentTime = s;
                                        clipStopAtRef.current = e;
                                        clipVideoRef.current.play();
                                      }}
                                    >
                                      Lire le clip
                                    </Button>
                                  </div>

                                  {clipDuration != null ? (
                                    <div className="space-y-2">
                                      <div className="text-xs text-gray-400">Navigation visuelle</div>
                                      <div className="grid grid-cols-1 gap-2">
                                        <input
                                          type="range"
                                          min="0"
                                          max={Math.floor(clipDuration)}
                                          step="0.5"
                                          value={questionClipStart === '' ? 0 : Number(questionClipStart)}
                                          onChange={(e) => setClipStartSafe(e.target.value)}
                                        />
                                        <input
                                          type="range"
                                          min="0"
                                          max={Math.floor(clipDuration)}
                                          step="0.5"
                                          value={questionClipEnd === '' ? Math.floor(clipDuration) : Number(questionClipEnd)}
                                          onChange={(e) => setClipEndSafe(e.target.value)}
                                        />
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <div className="mt-3 text-xs text-gray-400">
                                  La sélection visuelle IN/OUT est disponible pour les vidéos uploadées (lecteur HTML5). Pour YouTube/Vimeo, utilise les champs ci-dessous.
                                </div>
                              )}

                            </div>
                            <div className="text-xs text-gray-400">
                              {questionStatus === 'loading'
                                ? 'Envoi…'
                                : questionStatus === 'error'
                                  ? "Erreur: impossible d'envoyer la question."
                                  : questionStatus === 'sent'
                                    ? 'Question envoyée.'
                                    : ''}
                            </div>
                            <div className="flex items-center gap-3">
                              <label className="text-sm text-gray-300 flex items-center gap-2">
                                <input
                                  type="radio"
                                  name="question_visibility"
                                  checked={questionIsPublic}
                                  onChange={() => setQuestionIsPublic(true)}
                                />
                                Publique
                              </label>
                              <label className="text-sm text-gray-300 flex items-center gap-2">
                                <input
                                  type="radio"
                                  name="question_visibility"
                                  checked={!questionIsPublic}
                                  onChange={() => setQuestionIsPublic(false)}
                                />
                                Privée
                              </label>
                            </div>

                            <div className="border border-white/10 rounded-lg p-3 bg-black/20">
                              <div className="text-xs text-gray-400 uppercase tracking-wider">Séquence (clip)</div>
                              <div className="text-sm text-gray-300 mt-1">
                                Référence une séquence de la vidéo (en secondes). Optionnel.
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                <div className="space-y-1">
                                  <div className="text-xs text-gray-400">Début (s)</div>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={questionClipStart}
                                    onChange={(e) => setClipStartSafe(e.target.value)}
                                    className="w-full px-3 py-2 rounded bg-[#0F1419] border border-white/10 text-white"
                                    placeholder="ex: 12"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <div className="text-xs text-gray-400">Fin (s)</div>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={questionClipEnd}
                                    onChange={(e) => setClipEndSafe(e.target.value)}
                                    className="w-full px-3 py-2 rounded bg-[#0F1419] border border-white/10 text-white"
                                    placeholder="ex: 32"
                                  />
                                </div>
                              </div>
                            </div>
                            <Textarea
                              value={questionText}
                              onChange={(e) => {
                                const next = e.target.value;
                                setQuestionText(next);
                                const m = /(^|\s)@([\p{L}0-9_\-]{0,32})$/iu.exec(next);
                                if (m) {
                                  setMentionQuery(m[2] || '');
                                } else {
                                  setMentionQuery('');
                                  setMentionCandidates([]);
                                }
                              }}
                              className="bg-[#0F1419] border-white/10 min-h-[180px] text-white"
                              placeholder="Écris ta question ici..."
                            />

                            {selectedMentions.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {selectedMentions.map((m) => (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setSelectedMentions((prev) => prev.filter((x) => x.id !== m.id))}
                                    className="px-2 py-1 rounded bg-white/10 border border-white/10 text-xs text-white hover:bg-white/15"
                                    title="Cliquer pour retirer"
                                  >
                                    @{m.name}
                                  </button>
                                ))}
                              </div>
                            ) : null}

                            {mentionQuery !== '' ? (
                              <div className="border border-white/10 rounded-lg bg-[#0F1419] overflow-hidden">
                                <div className="px-3 py-2 text-xs text-gray-400 border-b border-white/10">
                                  Mentionner un prof / admin
                                </div>
                                {mentionLoading ? (
                                  <div className="px-3 py-2 text-sm text-gray-400">Recherche…</div>
                                ) : mentionCandidates.length === 0 ? (
                                  <div className="px-3 py-2 text-sm text-gray-400">Aucun résultat</div>
                                ) : (
                                  <div className="max-h-[180px] overflow-y-auto">
                                    {mentionCandidates.map((c) => (
                                      <button
                                        key={c.id}
                                        type="button"
                                        className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between"
                                        onClick={() => {
                                          setSelectedMentions((prev) => {
                                            if (prev.some((x) => x.id === c.id)) return prev;
                                            return [...prev, c];
                                          });
                                          setQuestionText((prev) => prev.replace(/(^|\s)@([\p{L}0-9_\-]{0,32})$/iu, `$1@${c.name} `));
                                          setMentionQuery('');
                                          setMentionCandidates([]);
                                        }}
                                      >
                                        <div className="text-sm text-white">{c.name}</div>
                                        <div className="text-[10px] text-gray-400">{c.role}</div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : null}

                            <div className="border border-white/10 rounded-lg p-3 bg-black/20">
                              <div className="text-xs text-gray-400 uppercase tracking-wider">Mes questions sur cette vidéo</div>
                              {myQuestionsLoading ? (
                                <div className="text-sm text-gray-400 mt-2">Chargement…</div>
                              ) : myQuestions.length === 0 ? (
                                <div className="text-sm text-gray-400 mt-2">Aucune question pour l'instant.</div>
                              ) : (
                                <div className="mt-3 space-y-2">
                                  {myQuestions.map((q) => {
                                    const editable = canEditQuestion(q.created_at);
                                    const shareUrl = formationForumBase ? `${window.location.origin}${formationForumBase}?questionId=${q.id}` : '';
                                    return (
                                      <div key={q.id} className="border border-white/10 rounded-lg p-3 bg-[#0F1419]">
                                        <div className="text-xs text-gray-500">{new Date(q.created_at).toLocaleString()}</div>
                                        <div className="text-sm text-gray-200 whitespace-pre-wrap mt-1">{q.question}</div>
                                        <div className="text-xs text-gray-400 mt-1">
                                          Séquence: {q.clip_start_seconds ?? '—'}s → {q.clip_end_seconds ?? '—'}s
                                        </div>
                                        <div className="flex flex-wrap items-center justify-end gap-2 mt-3">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-white/10 text-white hover:bg-white/5"
                                            onClick={async () => {
                                              if (!shareUrl) return;
                                              try {
                                                await navigator.clipboard.writeText(shareUrl);
                                                setQuestionToast('Lien copié.');
                                              } catch {
                                                setQuestionToast('Impossible de copier le lien.');
                                              }
                                            }}
                                          >
                                            Partager
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-white/10 text-white hover:bg-white/5"
                                            disabled={!editable}
                                            onClick={() => {
                                              setEditingQuestionId(q.id);
                                              setEditingCreatedAt(q.created_at);
                                              setQuestionText(q.question || '');
                                              setQuestionIsPublic(!!q.is_public);
                                              setClipStartSafe(q.clip_start_seconds ?? '');
                                              setClipEndSafe(q.clip_end_seconds ?? '');
                                            }}
                                          >
                                            Modifier (15 min)
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-red-500/30 text-red-200 hover:bg-red-500/10"
                                            disabled={!editable}
                                            onClick={async () => {
                                              if (!editable) return;
                                              const { error: err } = await supabase
                                                .from('formation_student_questions')
                                                .delete()
                                                .eq('id', q.id)
                                                .eq('student_id', user.id);
                                              if (!err) {
                                                setQuestionToast('Question supprimée.');
                                                loadMyQuestions();
                                              }
                                            }}
                                          >
                                            Supprimer
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                onClick={() => setActivePanel('video')}
                                className="border-white/10 text-white hover:bg-white/5"
                              >
                                Retour
                              </Button>
                              <Button
                                onClick={submitQuestion}
                                disabled={questionSending || !String(questionText || '').trim()}
                                className="bg-[#D4AF37] text-black hover:bg-yellow-500 font-bold"
                              >
                                {questionSending ? 'Envoi...' : editingQuestionId ? 'Enregistrer' : 'Envoyer'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="h-20" />
                  </div>

                  <div className="hidden md:flex w-[350px] lg:w-[400px] bg-[#192734] border-l border-white/10 flex-col z-10 shadow-xl">
                    <ProgressivePlaylist
                      playlistData={playlistData}
                      currentFormationId={formationId}
                      currentModuleId={activeItem?.ctx?.moduleId}
                      currentWeekId={activeItem?.ctx?.weekId}
                      currentDayId={activeItem?.ctx?.dayId}
                      currentVideoId={activeItem?.payload?.id}
                      onVideoSelect={(v, dayId, weekId, moduleId) => {
                        const mIdx = (modules || []).findIndex((mm) => mm?.id === moduleId);
                        const wIdx = mIdx >= 0 ? ((modules[mIdx]?.weeks || []).findIndex((ww) => ww?.id === weekId)) : -1;
                        const dIdx = mIdx >= 0 && wIdx >= 0 ? ((modules[mIdx]?.weeks?.[wIdx]?.days || []).findIndex((dd) => dd?.id === dayId)) : -1;
                        if (mIdx >= 0 && wIdx >= 0 && dIdx >= 0) {
                          selectSafe({ mIdx, wIdx, dIdx });
                          const mm = modules[mIdx];
                          const ww = mm?.weeks?.[wIdx];
                          const dd = ww?.days?.[dIdx];
                          setActiveItem({
                            kind: 'video',
                            key: `video-${v?.id || 'x'}`,
                            title: v?.title || 'Vidéo',
                            meta: v?.type || '',
                            payload: v,
                            ctx: {
                              mIdx,
                              wIdx,
                              dIdx,
                              moduleId: moduleId || mm?.id || null,
                              weekId: weekId || ww?.id || null,
                              dayId: dayId || dd?.id || null,
                              moduleTitle: mm?.title || '',
                              weekTitle: ww?.title || '',
                              dayTitle: dd?.title || '',
                            },
                          });
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="shrink-0 border-t border-white/10 bg-[#15202B] px-3 md:px-6 py-3 flex items-center justify-between gap-3">
                  <div className="text-xs text-gray-400 truncate">
                    {activePanel === 'video'
                      ? 'Vidéo'
                      : activePanel === 'presentation'
                        ? 'Présentation'
                        : activePanel === 'quiz'
                          ? 'Quiz'
                          : activePanel === 'questions'
                            ? 'Question'
                            : 'Cahier'}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={activePanel === 'video' ? 'secondary' : 'outline'}
                      onClick={() => setActivePanel('video')}
                      className={activePanel === 'video' ? 'bg-white/10 text-white' : 'border-white/10 text-white hover:bg-white/5'}
                    >
                      Vidéo
                    </Button>
                    <Button
                      size="sm"
                      variant={activePanel === 'presentation' ? 'secondary' : 'outline'}
                      disabled={!canShowPresentation}
                      onClick={() => setActivePanel('presentation')}
                      className={activePanel === 'presentation' ? 'bg-white/10 text-white' : 'border-white/10 text-white hover:bg-white/5'}
                    >
                      Présentation
                    </Button>
                    <Button
                      size="sm"
                      variant={activePanel === 'quiz' ? 'secondary' : 'outline'}
                      disabled={!canShowQuiz}
                      onClick={() => setActivePanel('quiz')}
                      className={activePanel === 'quiz' ? 'bg-white/10 text-white' : 'border-white/10 text-white hover:bg-white/5'}
                    >
                      Quiz
                    </Button>
                    <Button
                      size="sm"
                      variant={activePanel === 'notes' ? 'secondary' : 'outline'}
                      onClick={() => setActivePanel('notes')}
                      className={activePanel === 'notes' ? 'bg-white/10 text-white' : 'border-white/10 text-white hover:bg-white/5'}
                    >
                      Cahier
                    </Button>
                    <Button
                      size="sm"
                      variant={activePanel === 'questions' ? 'secondary' : 'outline'}
                      onClick={() => {
                        if (!questionsUnlocked) {
                          setQuestionToast(getQuestionsLockedReason());
                          return;
                        }
                        setActivePanel('questions');
                      }}
                      aria-disabled={!questionsUnlocked}
                      className={
                        activePanel === 'questions'
                          ? 'bg-white/10 text-white'
                          : !questionsUnlocked
                            ? 'border-white/10 text-white/40 opacity-60 cursor-not-allowed'
                            : 'border-white/10 text-white hover:bg-white/5'
                      }
                    >
                      Question
                    </Button>
                  </div>
                </div>
              </div>
            );
          })() : activeItem?.kind === 'support' ? (
            <div className="h-full overflow-auto p-6">
              <div className="max-w-5xl mx-auto">
                <PowerPointViewer powerpoint={activeItem?.payload || null} />
              </div>
            </div>
          ) : activeItem?.kind === 'quiz' ? (
            <div className="h-full overflow-auto p-6">
              <div className="max-w-3xl mx-auto border border-white/10 rounded-lg p-4 bg-white/5 space-y-3">
                <div className="text-sm text-gray-300">{activeItem?.payload?.questions?.length || 0} questions</div>
                <div className="space-y-2">
                  {(activeItem?.payload?.questions || []).slice(0, 5).map((q, idx) => (
                    <div key={idx} className="border border-white/10 rounded p-3 bg-black/20">
                      <div className="text-sm font-semibold">{idx + 1}. {q?.question || q?.title || 'Question'}</div>
                    </div>
                  ))}
                </div>
                {(activeItem?.payload?.questions || []).length > 5 ? (
                  <div className="text-xs text-gray-500">+ {(activeItem.payload.questions.length - 5)} autres questions...</div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="p-6 text-gray-400">Aucun contenu.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const CoursePlayerInterface = () => {
  const { id } = useParams();
  return (
    <VideoProgressProvider>
      {id ? <SupabaseCoursePlayerContent formationId={id} /> : <DemoCoursePlayerContent />}
    </VideoProgressProvider>
  );
};

export default CoursePlayerInterface;

export { SupabaseCoursePlayerContent };