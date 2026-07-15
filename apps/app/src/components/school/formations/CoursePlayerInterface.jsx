import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDataSync } from '@/contexts/DataSyncContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useBilling } from '@/contexts/BillingContext';
import { supabase } from '@/lib/customSupabaseClient';
import { api } from '@/lib/api';
import { useFormationStructure, normalizeFormationVideoPayload } from '@/hooks/useFormationStructure';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Lock, Unlock, CheckCircle, ArrowRight, Play, BookOpen, PenTool, ChevronRight, Menu, Heart, Video, Presentation, FileText, Sparkles, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { VideoProgressProvider } from '@/components/school/classroom/VideoProgressTracker';
import { SafeHtml } from '@/components/common/SafeHtml';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import VideoPlayer from '@/components/school/formations/VideoPlayer';
import PowerPointViewer from '@/components/school/formations/PowerPointViewer';
import ProgressivePlaylist from '@/components/school/classroom/ProgressivePlaylist';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import QuizPlayerInterface from '@/components/school/formations/QuizPlayerInterface';
import ChapterList from '@/components/lesson-player/ChapterList';
import TranscriptPanel from '@/components/lesson-player/TranscriptPanel';
import MindMapNavigation from '@/components/lesson-player/MindMapNavigation';
import NodeExplanationPanel from '@/components/lesson-player/NodeExplanationPanel';
import QuizPanel from '@/components/lesson-player/QuizPanel';
import StudentSmartboardDeck from '@/components/school/course-builder/StudentSmartboardDeck';
import ChapterInterlude from '@/components/school/course-builder/ChapterInterlude';
import ImmersiveClassroom from '@/components/school/course-builder/ImmersiveClassroom';
import { buildDeckFromMindmap } from '@/lib/smartboard/buildDeckFromMindmap';
import { buildClassroomChapters } from '@/lib/smartboard/buildClassroomChapters';
import QuestionPanel from '@/components/lesson-player/QuestionPanel';
import { tsToSeconds } from '@/components/lesson-player/types';
import NotesPanel from '@/components/lesson-player/NotesPanel';
import { cn } from '@/lib/utils';
import { formationForumUrlForRole } from '@/lib/forumDashboardPaths';
import { getEffectiveRole } from '@/lib/accountRoleMode';
import { useMessagingTopics } from '@/hooks/useMessagingTopics';

// Phase C — un Sujet de contexte vidéo n'a de sens que pour un video_id UUID réel
// (formation_day_contents.id). En fallback legacy (storagePath/url), on n'ouvre pas.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

// Lot 1 (CDC Tableau Vivant) — construit le contenu de l'interlude de reformulation
// d'un chapitre (titre + blocs Tableau Vivant + texte voix off) à partir du mindmap/deck.
function buildInterludeForChapter(videoMemo, chapterIndex) {
  try {
    const deck = buildDeckFromMindmap(videoMemo?.mindmap || null, Array.isArray(videoMemo?.chapters) ? videoMemo.chapters : []);
    const sections = deck?.sections || [];
    const section = sections.find((s) => s.chapterIndex === chapterIndex) || sections[chapterIndex];
    const slides = section?.slides || [];
    if (!slides.length) return null;
    const sc = (s) => s?.slideContent || {};
    const title = section.label || sc(slides[0]).title || slides[0].label || 'Reformulation';
    const idea = slides.map((s) => sc(s).ideeCentrale || s.summary).filter(Boolean)[0];
    const points = slides.map((s) => sc(s).aRetenir || s.label).filter(Boolean).slice(0, 4);
    const retain = slides.map((s) => sc(s).aRetenir).filter(Boolean)[0];
    const blocks = [];
    if (idea) blocks.push({ type: 'idea', label: 'Idée centrale', text: idea });
    if (points.length) blocks.push({ type: 'list', label: 'À revoir', items: points });
    if (retain) blocks.push({ type: 'retain', label: 'À retenir', text: retain });
    if (!blocks.length) return null;
    const narration = [title, idea, ...points, retain].filter(Boolean).join('. ');
    return { chapterLabel: section.label, title, blocks, narration };
  } catch {
    return null;
  }
}

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
    <div className="min-h-screen bg-[#262624] text-white flex flex-col">
      {/* Header Progress */}
      <div className="h-16 border-b border-[rgba(245,244,238,0.09)] flex items-center px-8 bg-[#262624]">
         <div className="flex-1">
           <h1 className="text-lg font-bold flex items-center gap-2">
             <span className="text-[#b0ada3]">{module?.title}</span> <ChevronRight className="h-4 w-4"/>
             <span className="text-[#b0ada3]">{week?.title}</span> <ChevronRight className="h-4 w-4"/>
             <span className="text-[var(--school-accent)]">{day.title}</span>
           </h1>
         </div>
         <div className="flex gap-2">
            {[1, 2, 3, 4].map(s => (
               <div key={s} className={`h-2 w-8 rounded-full ${step >= s ? 'bg-[var(--school-accent)]' : 'bg-gray-700'}`} />
            ))}
         </div>
      </div>

      <div className="flex-1 container mx-auto p-6 max-w-5xl">
        <AnimatePresence mode='wait'>
          {step === 1 && (
            <motion.div key="video" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: -20}}>
               <Card className="bg-black border border-[rgba(245,244,238,0.09)] aspect-video flex items-center justify-center relative group">
                  <div className="text-center">
                    <Play className="h-20 w-20 text-white opacity-50 group-hover:opacity-100 transition-opacity cursor-pointer"/>
                    <p className="mt-4 text-[#b0ada3]">Simulation: Vidéo terminée</p>
                  </div>
               </Card>
               <div className="mt-6 flex justify-end">
                  <Button onClick={() => setStep(2)} className="bg-[var(--school-accent)] text-black hover:brightness-110">
                    J'ai terminé la vidéo <ArrowRight className="ml-2 h-4 w-4"/>
                  </Button>
               </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="summary" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: -20}}>
               <Card className="bg-[#30302e] border border-[rgba(245,244,238,0.09)] p-8">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <BookOpen className="text-[var(--school-accent)]"/> Ce que tu dois retenir
                  </h2>
                  <SafeHtml className="prose prose-invert max-w-none" html={day.content.summary} />
               </Card>
               <div className="mt-6 flex justify-end">
                  <Button onClick={() => setStep(3)} className="bg-[var(--school-accent)] text-black hover:brightness-110">
                    J'ai bien lu et compris <ArrowRight className="ml-2 h-4 w-4"/>
                  </Button>
               </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="writing" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: -20}}>
               <Card className="bg-[#30302e] border border-[rgba(245,244,238,0.09)] p-8">
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                    <PenTool className="text-[var(--school-accent)]"/> Qu'as-tu retenu ?
                  </h2>
                  <p className="text-[#b0ada3] mb-6">{day.content.writingPrompt}</p>
                  <Textarea 
                    value={writingText}
                    onChange={(e) => setWritingText(e.target.value)}
                    placeholder="Écris ta réponse ici (min. 50 caractères)..."
                    className="h-64 bg-[#262624] border-[rgba(245,244,238,0.09)] text-white"
                  />
                  <div className="text-right text-sm text-[#82807a] mt-2">
                    {writingText.length} caractères
                  </div>
               </Card>
               <div className="mt-6 flex justify-end">
                  <Button onClick={handleWritingSubmit} className="bg-[var(--school-accent)] text-black hover:brightness-110">
                    Soumettre ma réponse <ArrowRight className="ml-2 h-4 w-4"/>
                  </Button>
               </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="quiz" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: -20}}>
               <Card className="bg-[#30302e] border border-[rgba(245,244,238,0.09)] p-8">
                  <h2 className="text-2xl font-bold mb-6">Quiz de validation</h2>
                  <div className="space-y-8">
                     {day.content.quiz.map((q, idx) => (
                       <div key={q.id} className="space-y-3">
                         <h3 className="font-medium text-lg">{idx + 1}. {q.question}</h3>
                         <RadioGroup onValueChange={(val) => setQuizAnswers({...quizAnswers, [idx]: parseInt(val)})}>
                            {q.options.map((opt, optIdx) => (
                              <div key={optIdx} className="flex items-center space-x-2">
                                <RadioGroupItem value={optIdx.toString()} id={`q${idx}-${optIdx}`} className="border-white/20 text-[var(--school-accent)]" />
                                <Label htmlFor={`q${idx}-${optIdx}`} className="text-[#c9c5bb]">{opt}</Label>
                              </div>
                            ))}
                         </RadioGroup>
                       </div>
                     ))}
                  </div>
               </Card>
               <div className="mt-6 flex justify-end">
                  <Button onClick={handleQuizSubmit} className="bg-[var(--school-accent)] text-black hover:brightness-110">
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
                <p className="text-xl text-[#b0ada3] mb-8">Vous avez complété le jour {day.dayNumber} avec succès.</p>
                <div className="flex justify-center gap-4">
                   <Button variant="outline" onClick={() => navigate('/formations')} className="border-[rgba(245,244,238,0.09)] text-white">
                     Retour aux formations
                   </Button>
                   <Button className="bg-[var(--school-accent)] text-black">
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
  const [panelOpen, setPanelOpen] = useState(false); // tiroir latéral programme — fermé par défaut (vue leçon immersive : on ne voit que la vidéo)
  const [smartboardOn, setSmartboardOn] = useState(false); // smartboard masqué par défaut — bascule depuis la vidéo
  const [notesText, setNotesText] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesStatus, setNotesStatus] = useState('idle');
  const [notesLastSavedAt, setNotesLastSavedAt] = useState(null);

  const videoPlayerRef = useRef(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);

  const [videoDone, setVideoDone] = useState(false);
  const [presentationDone, setPresentationDone] = useState(false);
  // Lot 1 — interlude de reformulation à la fin d'un chapitre (cf. CDC Tableau Vivant).
  const [chapterInterlude, setChapterInterlude] = useState(null);
  const playedInterludesRef = useRef(new Set());
  const [quizDone, setQuizDone] = useState(false);

  const [mindmapOpen, setMindmapOpen] = useState(false);
  const [mindmapMinimized, setMindmapMinimized] = useState(false);
  const [selectedMindmapPlayerNode, setSelectedMindmapPlayerNode] = useState(null);
  const [mindmapTab, setMindmapTab] = useState('mindmap'); // 'mindmap' | 'quiz'
  const [clickedMindmapNodeIds, setClickedMindmapNodeIds] = useState(new Set());
  const [liked, setLiked] = useState(false);

  // Minimum de mots du Cahier pour débloquer Questions/Discussion (abaissé de 100 → 20 :
  // 100 mots bloquait quasi tout le monde avant de pouvoir poser une question).
  const MIN_NOTES_WORDS = 20;
  const notesWordCount = useMemo(() => {
    const txt = String(notesText || '').trim();
    if (!txt) return 0;
    return txt.split(/\s+/).filter(Boolean).length;
  }, [notesText]);
  const notesFilled = useMemo(() => notesWordCount >= MIN_NOTES_WORDS, [notesWordCount, MIN_NOTES_WORDS]);

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

  // ── Phase C — panneau « Discussion » (Sujet de contexte vidéo) ─────────────────
  // ADDITIF : un fil de discussion par vidéo (kind='topic', visibility='context'),
  // get-or-create idempotent à la 1re ouverture du panneau, réservé aux inscrits +
  // encadrement (contrôle d'accès côté API). Chemin de données isolé du reste du
  // lecteur : si l'API échoue/refuse, le panneau dégrade en silence, la vidéo continue.
  const {
    activeTopic: discussionTopic,
    topicMessages: discussionMessages,
    topicMessagesLoading: discussionLoading,
    getOrCreateContextTopic,
    sendTopicMessage: sendDiscussionMessage,
    closeActiveTopicView: closeDiscussionView,
  } = useMessagingTopics(user?.id);

  const [discussionText, setDiscussionText] = useState('');
  const [discussionSending, setDiscussionSending] = useState(false);
  const [discussionError, setDiscussionError] = useState(false);
  // Mémorise le video_id déjà résolu pour ne lancer le get-or-create qu'une fois par vidéo.
  const discussionOpenedForRef = useRef(null);

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

  // Objet vidéo RÉELLEMENT passé au lecteur. Pour une vidéo HÉBERGÉE (storagePath), on n'expose
  // QUE l'URL signée par l'API gatée (`clipPlayableUrl`) et on retire `storagePath` pour que
  // VideoPlayer ne re-signe PAS lui-même (sinon il rouvrirait le trou via la RLS storage). Le
  // montage post-prod (renderedUrl) et les vidéos externes restent inchangés.
  const playerVideo = useMemo(() => {
    const v = currentVideoMemo;
    if (!v) return null;
    if (v.renderedUrl || !v.storagePath) return v; // montage ou vidéo externe → tel quel
    if (!clipPlayableUrl) return { ...v, storagePath: undefined, url: '' };
    return { ...v, storagePath: undefined, url: clipPlayableUrl, renderedUrl: clipPlayableUrl };
  }, [currentVideoMemo, clipPlayableUrl]);

  // « Salle de classe » immersive (plein écran, non destructif) — disponible
  // uniquement si le cours a déjà son contenu généré (mindmap post-prod).
  const [showClassroom, setShowClassroom] = useState(false);
  const classroomChapters = useMemo(() => buildClassroomChapters(currentVideoMemo), [currentVideoMemo]);

  // Phase C — video_id du Sujet de discussion = formation_day_contents.id (UUID réel).
  const discussionVideoId = useMemo(() => {
    const vid = currentVideoMemo?.id || activeItem?.payload?.id || '';
    return isUuid(vid) ? vid : null;
  }, [currentVideoMemo?.id, activeItem?.payload?.id]);

  // Réinitialise le fil de discussion quand on change de vidéo (chaque vidéo a son Sujet).
  useEffect(() => {
    discussionOpenedForRef.current = null;
    setDiscussionText('');
    setDiscussionError(false);
    closeDiscussionView();
  }, [discussionVideoId, closeDiscussionView]);

  // À l'ouverture du panneau Discussion : get-or-create idempotent du Sujet de la vidéo
  // courante, puis ouverture de son fil. Une seule fois par vidéo (ref de garde).
  // Dégrade en silence : pas de course_id ou pas de video_id UUID → panneau vide informatif.
  useEffect(() => {
    if (activePanel !== 'discussion') return;
    if (!user?.id || !discussionVideoId || !formationKey) return;
    if (discussionOpenedForRef.current === discussionVideoId) return;
    discussionOpenedForRef.current = discussionVideoId;
    setDiscussionError(false);
    (async () => {
      const topic = await getOrCreateContextTopic({
        contextType: 'video',
        contextId: discussionVideoId,
        courseId: formationKey,
        subject: activeItem?.title ? `Questions — ${activeItem.title}` : undefined,
      });
      if (!topic) {
        // Échec/refus (ex. 403 non inscrit) → on autorise une nouvelle tentative et on
        // affiche l'état d'indisponibilité plutôt qu'un panneau cassé.
        discussionOpenedForRef.current = null;
        setDiscussionError(true);
      }
    })();
  }, [activePanel, user?.id, discussionVideoId, formationKey, activeItem?.title, getOrCreateContextTopic]);

  const handleSendDiscussion = async () => {
    const c = String(discussionText || '').trim();
    if (!c || discussionSending || !discussionTopic?.id) return;
    setDiscussionSending(true);
    const ok = await sendDiscussionMessage(c);
    setDiscussionSending(false);
    if (ok) setDiscussionText('');
  };

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
            // Rattachement à la source pour le hub « Mes notes » (source polymorphe).
            source_type: 'course',
            source_id: String(formationKey),
            source_title: formation?.title || null,
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
    setChapterInterlude(null);
    playedInterludesRef.current = new Set();
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
      const contentId = v?.id;

      // Vidéo EXTERNE (youtube/vimeo/url brute, pas de fichier hébergé) → lecture directe.
      if (!storagePath) {
        setClipPlayableUrl(url);
        return;
      }

      // Vidéo HÉBERGÉE (bucket privé `videos`) → l'URL signée est délivrée par l'API GATÉE
      // (POST /courses/:id/video-url) qui vérifie palier + inscription CÔTÉ SERVEUR. On ne
      // signe JAMAIS directement côté client : sinon un lien partagé / un mauvais palier
      // contournerait le gate (la RLS storage laisse passer tout authentifié).
      if (!effectiveFormationId || !contentId) {
        setClipPlayableUrl('');
        return;
      }
      try {
        const { data: resp } = await api.post(`/courses/${effectiveFormationId}/video-url`, { contentId });
        if (!alive) return;
        const signed = resp?.data?.url || resp?.url || '';
        setClipPlayableUrl(signed); // vide si refus serveur → le lecteur ne montre rien
      } catch {
        if (!alive) return;
        // Refus (403) ou erreur : PAS de repli vers l'URL brute pour une vidéo hébergée
        // (cela ré-ouvrirait le trou). La vidéo n'est simplement pas lue.
        setClipPlayableUrl('');
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [activeItem?.kind, activeItem?.payload, effectiveFormationId]);

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

  if (loading) return <div className="min-h-screen bg-[#262624] text-white p-10">Chargement…</div>;
  if (error) {
    return (
      <div className="min-h-screen bg-[#262624] text-white p-10">
        <div className="max-w-xl space-y-4">
          <div className="text-lg font-semibold">Accès indisponible</div>
          <div className="text-sm text-[#c9c5bb]">{error}</div>
          <div className="pt-2">
            <Button variant="outline" className="border-[rgba(245,244,238,0.09)] text-white" onClick={() => navigate('/formations')}>
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
    <div className="min-h-screen bg-[#262624] text-white flex flex-col relative overflow-hidden">
      <style>{`
        @keyframes cpiFloat { 0%,100%{transform:translate3d(0,0,0) scale(1)} 50%{transform:translate3d(0,-22px,0) scale(1.07)} }
        .cpi-orb{ filter: blur(86px); opacity:.2; animation: cpiFloat 16s ease-in-out infinite; will-change: transform; }
        .cpi-orb.alt{ animation-duration:20s; animation-delay:-4s; }
        @media (prefers-reduced-motion: reduce){ .cpi-orb{ animation:none } }
        /* Fond noir sur le lecteur vidéo en attente de chargement — évite le rectangle gris */
        video { background: #262624 !important; }
      `}</style>
      {/* Ambient background — MÊME scène immersive que le détail du cours (TenantCourseDetailPage) */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute inset-0" style={{ background:
          'radial-gradient(80% 50% at 50% -5%, rgba(217,119,87,0.12), transparent 55%),' +
          'radial-gradient(65% 55% at 92% 104%, rgba(217,119,87,0.06), transparent 62%),' +
          'radial-gradient(55% 50% at 4% 98%, rgba(226,146,106,0.045), transparent 62%)' }} />
        <div className="absolute left-1/2 top-0 h-[140vh] w-[140vh] -translate-x-1/2" style={{
          background: 'conic-gradient(from 198deg at 50% 32%, transparent 0deg, rgba(217,119,87,0.09) 38deg, transparent 80deg, transparent 188deg, rgba(226,146,106,0.04) 224deg, transparent 300deg)',
          opacity: 0.42, filter: 'blur(3px)',
          WebkitMaskImage: 'radial-gradient(ellipse 50% 40% at 50% 28%, #000 0%, transparent 72%)',
          maskImage: 'radial-gradient(ellipse 50% 40% at 50% 28%, #000 0%, transparent 72%)' }} />
        <span className="cpi-orb absolute -left-10 top-16 h-72 w-72 rounded-full" style={{ background: '#d97757' }} />
        <span className="cpi-orb alt absolute -right-10 top-1/4 h-80 w-80 rounded-full" style={{ background: '#e0926a', opacity: 0.1 }} />
        <span className="cpi-orb absolute bottom-10 left-1/3 h-64 w-64 rounded-full" style={{ background: '#c98b6a', opacity: 0.09 }} />
        <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 220px 50px rgba(0,0,0,0.5)' }} />
      </div>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="h-16 border-b border-[rgba(245,244,238,0.06)] flex items-center px-6 bg-[#262624]/55 backdrop-blur-xl sticky top-0 z-20"
      >
        <Button variant="ghost" onClick={handleExit} className="text-[#b0ada3] hover:text-white hover:bg-white/5 -ml-2">
          <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Retour
        </Button>
        <div className="flex-1 px-6 min-w-0">
          <h1 className="truncate" style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontWeight: 600, fontSize: 18, color: '#f5f4ee' }}>
            {formation?.title || 'Formation'}
          </h1>
          <div className="flex items-center gap-2 text-xs text-[#82807a] mt-0.5">
            <Layers className="w-3.5 h-3.5 text-[color-mix(in_srgb,var(--school-accent)_80%,transparent)]" />
            <span className="truncate">{m?.title || ''}{w?.title ? ` › ${w.title}` : ''}{d?.title ? ` › ${d.title}` : ''}</span>
          </div>
        </div>
        <Button
          variant="outline"
          className="border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]"
          onClick={() => { if (formationForumBase) navigate(formationForumBase); }}
        >
          Forum
        </Button>
      </motion.header>

      <div className="flex-1 w-full max-w-3xl mx-auto px-4 pb-20">
        {/* Hero du jour courant — centré, comme l'écran détail */}
        {!d ? (
          <div className="flex flex-col items-center text-center pt-12 pb-4">
            <BookOpen className="w-12 h-12 text-gray-600 mb-3" />
            <p className="text-[#c9c5bb] font-medium">Sélectionne un jour dans le programme</p>
            <p className="text-sm text-[#82807a] mt-1">pour afficher le contenu</p>
          </div>
        ) : (
          <motion.div
            key={`hero-${path.mIdx}-${path.wIdx}-${path.dIdx}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col items-center text-center pt-16 pb-4"
          >
            <span className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(217,119,87,0.12)', border: '1px solid rgba(217,119,87,0.28)', color: 'var(--school-accent)' }}>
              <Play className="w-6 h-6" />
            </span>
            {[m?.title, w?.title].filter(Boolean).length > 0 && (
              <div className="mt-5 text-[11px] tracking-[0.28em] uppercase" style={{ color: 'var(--school-accent)', opacity: 0.85 }}>
                {[m?.title, w?.title].filter(Boolean).join(' · ')}
              </div>
            )}
            <h2 className="mt-2" style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontWeight: 600, fontSize: 'clamp(30px, 4.4vw, 46px)', lineHeight: 1.08, letterSpacing: '-0.01em', color: '#f5f4ee', textWrap: 'balance' }}>{d.title}</h2>
            {contentCards.length > 0 ? (
              <button
                type="button"
                onClick={() => setActiveItem(contentCards[0])}
                className="mt-8 inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold transition-transform active:scale-[0.99]"
                style={{ background: 'var(--school-accent)', color: '#1c1a17', boxShadow: '0 14px 40px rgba(217,119,87,0.28)' }}
              >
                <Play className="w-4 h-4" /> Commencer la leçon
              </button>
            ) : (
              <p className="mt-4 text-sm text-[#82807a]">Aucun contenu pour ce jour.</p>
            )}
          </motion.div>
        )}

        {/* Programme — filets fins (fondu), comme l'écran détail */}
        {modules.length > 0 && (
          <div className="mt-12">
            <h3 className="text-center text-[13px] font-semibold uppercase tracking-[0.14em] mb-4" style={{ color: 'rgba(245,245,247,0.6)' }}>Programme</h3>
            <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.09)', borderBottom: '0.5px solid rgba(255,255,255,0.09)' }}>
              {modules.map((mod, mIdx) => {
                const mOpen = mIdx === path.mIdx;
                return (
                  <div key={mod.id || mIdx} style={{ borderTop: mIdx === 0 ? 'none' : '0.5px solid rgba(255,255,255,0.06)' }}>
                    <button
                      type="button"
                      onClick={() => selectSafe({ mIdx })}
                      className="w-full flex items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-white/[0.025]"
                    >
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={mOpen ? { background: 'rgba(217,119,87,0.18)', color: 'var(--school-accent)' } : { background: 'rgba(255,255,255,0.08)', color: 'rgba(245,245,247,0.5)' }}>{mIdx + 1}</span>
                      <span className="flex-1 text-sm font-medium truncate" style={{ color: mOpen ? '#fff' : 'rgba(245,245,247,0.8)' }}>{mod.title || `Module ${mIdx + 1}`}</span>
                      <ChevronRight className="w-4 h-4 shrink-0 transition-transform" style={{ color: 'rgba(245,245,247,0.4)', transform: mOpen ? 'rotate(90deg)' : 'none' }} />
                    </button>
                    {mOpen && (mod.weeks || []).map((week, wIdx) => {
                      const wOpen = wIdx === path.wIdx;
                      return (
                        <div key={week.id || wIdx}>
                          <button type="button" onClick={() => selectSafe({ mIdx, wIdx })} className="w-full flex items-center gap-2 pl-10 pr-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.025]" style={{ color: wOpen ? '#fff' : 'rgba(245,245,247,0.55)' }}>
                            <ChevronRight className="w-3.5 h-3.5 transition-transform" style={{ transform: wOpen ? 'rotate(90deg)' : 'none' }} />
                            <span className="truncate">{week.title || `Semaine ${wIdx + 1}`}</span>
                          </button>
                          {wOpen && (week.days || []).map((day, dIdx) => {
                            const dOpen = dIdx === path.dIdx;
                            return (
                              <div key={day.id || dIdx}>
                                <button type="button" onClick={() => selectSafe({ mIdx, wIdx, dIdx })} className="w-full flex items-center gap-2 pl-16 pr-3 py-2 text-left text-sm transition-colors" style={{ color: dOpen ? 'var(--school-accent)' : 'rgba(245,245,247,0.5)' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(217,119,87,0.06)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                                  <Play className="w-3.5 h-3.5 opacity-80 shrink-0" />
                                  <span className="flex-1 truncate">{day.title || `Jour ${dIdx + 1}`}</span>
                                </button>
                                {dOpen && contentCards.map((c) => {
                                  const Icon = c.kind === 'video' ? Video : c.kind === 'support' ? Presentation : FileText;
                                  return (
                                    <button key={c.key} type="button" onClick={() => setActiveItem(c)} className="w-full flex items-center gap-2.5 pr-3 py-2 text-left transition-colors" style={{ paddingLeft: '5.5rem' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(217,119,87,0.06)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                                      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--school-accent)' }} />
                                      <span className="flex-1 truncate text-[13px] text-white">{c.title}</span>
                                      <span className="text-[10px] uppercase tracking-wide shrink-0" style={{ color: 'var(--school-accent)' }}>{c.kind === 'video' ? 'Vidéo' : c.kind === 'support' ? 'Support' : 'Texte'}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!activeItem} onOpenChange={(open) => { if (!open) setActiveItem(null); }}>
        <DialogContent className="max-w-[98vw] w-full h-[92vh] bg-[#262624] border border-[rgba(245,244,238,0.09)] p-0 overflow-hidden text-white [&>button]:hidden">
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

            // Gating pédagogique (vidéo + présentation + quiz + 20 mots avant Question/
            // Discussion/Forum). Piloté par ENV au lieu d'un `false` codé en dur (audit P1) :
            // OFF par défaut (aucune régression), activable au build via VITE_COURSE_GATING=on.
            const GATING_ENABLED = String(import.meta.env.VITE_COURSE_GATING ?? '').toLowerCase() === 'on';
            const questionsUnlocked = !GATING_ENABLED || (
              videoDone
              && (!canShowPresentation || presentationDone)
              && (!canShowQuiz || quizDone)
              && notesFilled
            );

            const getQuestionsLockedReason = () => {
              if (!videoDone) return 'Termine la vidéo pour débloquer les questions.';
              if (canShowPresentation && !presentationDone) return "Va jusqu'au dernier slide de la présentation.";
              if (canShowQuiz && !quizDone) return 'Termine le quiz pour continuer.';
              if (!notesFilled) {
                const missing = Math.max(0, MIN_NOTES_WORDS - notesWordCount);
                return `Remplis ton cahier (minimum ${MIN_NOTES_WORDS} mots). Il manque ${missing} mot${missing > 1 ? 's' : ''}.`;
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
              <div className="relative h-full text-white flex flex-col overflow-hidden" style={{ background: '#262624' }}>
                {/* Ambiance immersive identique aux autres écrans : orbes flottants + halos + rayon conique */}
                {/* Halos de fond : restent à z-0 pour la couche basse (profondeur derrière tout) */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
                  <div className="absolute inset-0" style={{ background:
                    'radial-gradient(80% 50% at 50% -5%, rgba(217,119,87,0.12), transparent 55%),' +
                    'radial-gradient(65% 55% at 92% 104%, rgba(217,119,87,0.06), transparent 62%),' +
                    'radial-gradient(55% 50% at 4% 98%, rgba(226,146,106,0.045), transparent 62%)' }} />
                  <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 220px 50px rgba(0,0,0,0.5)' }} />
                </div>
                {/* Orbes flottants larges z-4 — couvrent TOUTE la scène vidéo (pointer-events-none, contrôles natifs toujours accessibles) */}
                <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 4 }}>
                  <span className="cpi-orb absolute rounded-full" style={{ background: '#d97757', opacity: 0.09, left: '-5%', top: '-10%', width: '55vw', height: '55vh', filter: 'blur(140px)' }} />
                  <span className="cpi-orb alt absolute rounded-full" style={{ background: '#e0926a', opacity: 0.07, right: '-5%', bottom: '-10%', width: '50vw', height: '50vh', filter: 'blur(130px)' }} />
                  <span className="cpi-orb absolute rounded-full" style={{ background: '#c98b6a', opacity: 0.045, left: '20%', bottom: '5%', width: '40vw', height: '40vh', filter: 'blur(120px)' }} />
                </div>
                {/* CSS leçon — fond noir sur la vidéo (état de chargement gris → noir) */}
                <style>{`video{background:#262624!important}`}</style>
                {/* Header transparent — flottant sur la scène, sans fond opaque */}
                <header className="h-14 flex items-center justify-between px-4 md:px-6 shrink-0 relative" style={{ zIndex: 20, background: 'linear-gradient(to bottom, rgba(11,11,15,0.85), transparent)' }}>
                  <div className="flex items-center gap-4 min-w-0">
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="md:hidden text-[var(--school-accent)]">
                          <Menu className="w-6 h-6" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="left" className="p-0 bg-[#30302e] border-r border-[rgba(245,244,238,0.09)] w-[85%] sm:w-[350px]">
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
                      <p className="text-[10px] md:text-sm text-[#b0ada3] truncate max-w-[260px] md:max-w-xl">
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
                      className="md:hidden border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5 font-bold text-xs h-8"
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
                      className="border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5 font-bold text-xs h-8"
                    >
                      Forum
                    </Button>
                    <Button variant="outline" onClick={() => setActiveItem(null)} className="border-[var(--school-accent)] text-[var(--school-accent)] hover:bg-[var(--school-accent)] hover:text-black font-bold text-xs h-8">
                      Fermer
                    </Button>
                    </div>
                  </div>
                </header>

                <div className="flex-1 flex overflow-hidden relative" style={{ zIndex: 1 }}>
                  <div className="flex-1 flex flex-col overflow-y-auto">
                    <div className="w-full">
                      {activePanel === 'video' ? (
                        <div className="space-y-6">
                          {/* Écran UNIQUE plein-bleed : la vidéo occupe tout l'espace, fondue dans le fond immersif (vignette inset), sans cadre ni carte flottante */}
                          <div className="relative w-full">
                            {/* Bouton SmartBoard flottant — hors du container overflow-hidden, toujours visible en haut à droite de la vidéo */}
                            <button
                              type="button"
                              onClick={() => setSmartboardOn(v => !v)}
                              style={{
                                position: 'absolute',
                                top: '22px',
                                right: '10px',
                                zIndex: 30,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '5px 10px',
                                borderRadius: '20px',
                                background: smartboardOn
                                  ? 'rgba(217,119,87,0.22)'
                                  : 'rgba(15,15,18,0.72)',
                                border: smartboardOn
                                  ? '1px solid rgba(217,119,87,0.55)'
                                  : '1px solid rgba(255,255,255,0.12)',
                                color: smartboardOn ? '#d97757' : 'rgba(255,255,255,0.55)',
                                fontSize: '11px',
                                fontWeight: 600,
                                letterSpacing: '0.04em',
                                backdropFilter: 'blur(10px)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                              }}
                              title={smartboardOn ? 'Masquer le SmartBoard' : 'Afficher le SmartBoard'}
                            >
                              <Sparkles size={12} />
                              SmartBoard
                            </button>
                            <div className="pointer-events-none absolute -inset-24 -z-10" style={{ background: 'radial-gradient(ellipse at 50% 42%, rgba(217,119,87,0.12), rgba(8,8,11,0) 66%)', filter: 'blur(40px)' }} />
                            <div className="relative overflow-hidden" style={{ background: '#262624', boxShadow: 'inset 0 0 160px 70px #08080b' }}>
                          <VideoPlayer
                            ref={videoPlayerRef}
                            video={playerVideo}
                            onEnded={handleVideoEnded}
                            onTimeUpdate={(t) => {
                              setVideoCurrentTime(t);
                              // Lot 1 — les chapitres sont des marqueurs de DÉBUT (timeSeconds) : la fin du
                              // chapitre i = le début du chapitre i+1. Quand on franchit cette frontière,
                              // on met la vidéo en pause et on joue l'interlude du chapitre qui se termine.
                              if (chapterInterlude) return;
                              const raw = currentVideoMemo?.chapters || currentVideoMemo?.timestamps || [];
                              const marks = (Array.isArray(raw) ? raw : [])
                                .map((c) => Number(c?.timeSeconds ?? c?.time ?? c?.seconds))
                                .filter((n) => Number.isFinite(n))
                                .sort((a, b) => a - b);
                              for (let i = 1; i < marks.length; i += 1) {
                                const boundary = marks[i];
                                const ended = i - 1;
                                if (t >= boundary - 0.25 && t < boundary + 2 && !playedInterludesRef.current.has(ended)) {
                                  const data = buildInterludeForChapter(currentVideoMemo, ended);
                                  if (data) {
                                    playedInterludesRef.current.add(ended);
                                    videoPlayerRef.current?.pause?.();
                                    setChapterInterlude(data);
                                  }
                                  break;
                                }
                              }
                            }}
                            overlay={smartboardOn ? (() => {
                              const mm = currentVideoMemo?.mindmap || null;
                              const chs = Array.isArray(currentVideoMemo?.chapters) ? currentVideoMemo.chapters : [];
                              if (!mm || !chs.length) return null;
                              return (
                                <StudentSmartboardDeck
                                  variant="overlay"
                                  mindmap={mm}
                                  chapters={chs}
                                  currentTime={videoCurrentTime}
                                  onSeek={seekVideoTo}
                                  syncToVideo
                                  className="h-full"
                                />
                              );
                            })() : null}
                          />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={videoDone}
                              onClick={() => setVideoDone(true)}
                              title="Valider que tu as regardé la vidéo (débloque la suite même si la lecture ne s'est pas terminée d'elle-même)"
                              className={
                                videoDone
                                  ? 'border-green-500/40 text-green-300 hover:bg-white/5 font-bold'
                                  : 'border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5 font-bold'
                              }
                            >
                              {videoDone ? '✓ Vidéo vue' : "J'ai vu la vidéo"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className={
                                liked
                                  ? 'border-[var(--school-accent)] text-[var(--school-accent)] hover:bg-white/5 font-bold'
                                  : 'border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5 font-bold'
                              }
                              onClick={() => setLiked((v) => !v)}
                            >
                              <Heart className={liked ? 'w-4 h-4 mr-2 fill-current' : 'w-4 h-4 mr-2'} />
                              Like
                            </Button>
                          </div>
                          {(() => {
                            const mm = currentVideoMemo?.mindmap || null;
                            const chs = Array.isArray(currentVideoMemo?.chapters) ? currentVideoMemo.chapters : [];
                            if (!mm || !chs.length) return null;
                            return (
                              <div className="space-y-1.5 md:hidden">
                                <div className="text-xs text-[var(--school-accent)] uppercase tracking-wider font-semibold">SmartBoard — les cartes du cours</div>
                                <StudentSmartboardDeck
                                  mindmap={mm}
                                  chapters={chs}
                                  currentTime={videoCurrentTime}
                                  onSeek={seekVideoTo}
                                  syncToVideo
                                  mode="reformulation"
                                  panelHeightClass="h-[420px]"
                                />
                                <p className="text-[11px] text-[#82807a]">Les slides défilent avec la vidéo. Tu peux aussi naviguer carte par carte.</p>
                              </div>
                            );
                          })()}

                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="lg:col-span-2 border border-[rgba(245,244,238,0.09)] rounded-xl bg-[#30302e]/60 backdrop-blur p-5">
                              <div className="text-xs text-[var(--school-accent)] uppercase tracking-wider font-semibold mb-2">Résumé</div>
                              <div className="text-sm text-gray-200 whitespace-pre-wrap mt-2">
                                {String(currentVideoMemo?.summary || currentVideoMemo?.description || '').trim() || '—'}
                              </div>
                            </div>
                            <div className="border border-[rgba(245,244,238,0.09)] rounded-xl bg-[#30302e]/60 backdrop-blur p-5">
                              <div className="text-xs text-[var(--school-accent)] uppercase tracking-wider font-semibold mb-2">Points clés</div>
                              <div className="text-sm text-gray-200 whitespace-pre-wrap mt-2">
                                {String(currentVideoMemo?.keyPoints || '').trim() || '—'}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="border border-[rgba(245,244,238,0.09)] rounded-xl bg-[#30302e]/60 backdrop-blur p-5">
                              <ChapterList
                                timestamps={Array.isArray(currentVideoMemo?.timestamps) ? currentVideoMemo.timestamps : []}
                                currentTimeSeconds={videoCurrentTime}
                                onSeek={seekVideoTo}
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <div className="border border-[rgba(245,244,238,0.09)] rounded-xl bg-white/5 px-3 py-2">
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
                                      ? 'border-[var(--school-accent)] text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] font-bold gap-2'
                                      : 'border-[rgba(245,244,238,0.09)] text-[#82807a] cursor-not-allowed opacity-50 gap-2'
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

                            {/* Lot 1 — interlude de reformulation plein écran (pause fin de chapitre + voix off). */}
                            <ChapterInterlude
                              open={!!chapterInterlude}
                              chapterLabel={chapterInterlude?.chapterLabel}
                              title={chapterInterlude?.title}
                              subtitle={chapterInterlude?.subtitle}
                              blocks={chapterInterlude?.blocks || []}
                              narration={chapterInterlude?.narration}
                              supabase={supabase}
                              onContinue={() => { setChapterInterlude(null); videoPlayerRef.current?.play?.(); }}
                            />

                            {/* Salle de classe immersive — petit bouton au coin + overlay plein écran.
                                NON destructif : la vidéo scrubbable, le forum et les notes restent dessous.
                                Visible seulement si le cours a déjà son contenu généré (post-prod). */}
                            {classroomChapters.length > 0 && !showClassroom ? (
                              <button
                                type="button"
                                onClick={() => { videoPlayerRef.current?.pause?.(); setShowClassroom(true); }}
                                title="Voir le cours en plein écran — le tableau qui enseigne (narré)"
                                className="fixed right-5 top-24 z-[120] inline-flex items-center gap-2 rounded-full border border-[var(--school-accent,#d97757)]/40 bg-[#262624]/90 px-4 py-2.5 text-sm font-semibold text-[var(--school-accent,#d97757)] shadow-xl backdrop-blur transition-colors hover:bg-[#262624]"
                              >
                                <Sparkles className="h-4 w-4" /> Salle de classe
                              </button>
                            ) : null}
                            <ImmersiveClassroom
                              open={showClassroom}
                              chapters={classroomChapters}
                              title={currentVideoMemo?.title || 'Cours'}
                              supabase={supabase}
                              onClose={() => setShowClassroom(false)}
                            />

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
                                    <div className="bg-[#262624]/95 border border-[rgba(245,244,238,0.09)] rounded-xl shadow-2xl backdrop-blur px-3 py-2 flex items-center gap-2">
                                      <div className="text-xs text-gray-200 font-semibold">Mindmap</div>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="h-7 px-2 border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5"
                                        onClick={() => setMindmapMinimized(false)}
                                      >
                                        Ouvrir
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="h-7 px-2 border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5"
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
                                    <div className="w-[98vw] md:w-[1100px] h-[82vh] bg-[#262624]/95 border border-[rgba(245,244,238,0.09)] rounded-2xl overflow-hidden shadow-2xl backdrop-blur">
                                      {(() => {
                                        const mindmapData = currentVideoMemo?.mindmap || null;
                                        const countNodes = (n) => n ? 1 + (n.children || []).reduce((s, c) => s + countNodes(c), 0) : 0;
                                        const totalNodes = countNodes(mindmapData);
                                        const quizThreshold = totalNodes > 0 ? Math.max(1, Math.ceil(totalNodes * 0.5)) : 0;
                                        // Verrou Quiz désactivé en mode test (GATING_ENABLED=false) : le Quiz
                                        // s'ouvre sans avoir à cliquer tous les nœuds de la mindmap.
                                        const allNodesClicked = !GATING_ENABLED || (quizThreshold > 0 && clickedMindmapNodeIds.size >= quizThreshold);
                                        return (
                                          <>
                                            <div className="h-12 px-3 flex items-center justify-between border-b border-[rgba(245,244,238,0.09)] bg-black/30">
                                              <div className="flex items-center gap-1">
                                                <button
                                                  type="button"
                                                  onClick={() => setMindmapTab('mindmap')}
                                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                                    mindmapTab === 'mindmap'
                                                      ? 'bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[var(--school-accent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]'
                                                      : 'text-[#b0ada3] hover:text-white'
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
                                                      ? 'bg-[#d97757]/15 text-[#e58a5f] border border-[#d97757]/30'
                                                      : 'text-[#b0ada3] hover:text-white'
                                                  }`}
                                                >
                                                  {allNodesClicked ? '🏆' : '🔒'} Quiz
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setMindmapTab('question')}
                                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                                    mindmapTab === 'question'
                                                      ? 'bg-[#e0926a]/15 text-[#e0926a] border border-[#e0926a]/30'
                                                      : 'text-[#b0ada3] hover:text-white'
                                                  }`}
                                                >
                                                  💬 Question
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setMindmapTab('slides')}
                                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                                    mindmapTab === 'slides'
                                                      ? 'bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[var(--school-accent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]'
                                                      : 'text-[#b0ada3] hover:text-white'
                                                  }`}
                                                >
                                                  🃏 Slides
                                                </button>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <Button type="button" variant="outline" className="h-8 border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5" onClick={() => setMindmapMinimized(true)}>Réduire</Button>
                                                <Button type="button" variant="outline" className="h-8 border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5" onClick={() => { setMindmapMinimized(false); setMindmapOpen(false); }}>Fermer</Button>
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
                                            {mindmapTab === 'slides' && (
                                              <div className="h-[calc(82vh-3rem)] overflow-y-auto p-3">
                                                {(() => {
                                                  const mm = currentVideoMemo?.mindmap || null;
                                                  const chs = Array.isArray(currentVideoMemo?.chapters) ? currentVideoMemo.chapters : [];
                                                  if (!mm || !chs.length) {
                                                    return <div className="h-full flex items-center justify-center text-sm text-[#82807a]">Aucune carte disponible pour ce cours.</div>;
                                                  }
                                                  return (
                                                    <StudentSmartboardDeck
                                                      mindmap={mm}
                                                      chapters={chs}
                                                      currentTime={videoCurrentTime}
                                                      onSeek={(t) => { seekVideoTo(t); }}
                                                      syncToVideo={false}
                                                      mode="reformulation"
                                                      panelHeightClass="h-[calc(82vh-9rem)]"
                                                    />
                                                  );
                                                })()}
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
                                                <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2 border-b border-[rgba(245,244,238,0.09)] bg-black/20">
                                                  <button
                                                    type="button"
                                                    onClick={() => setQuestionsSubTab('ia')}
                                                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                                      questionsSubTab === 'ia'
                                                        ? 'bg-[#e0926a]/15 text-[#e0926a] border border-[#e0926a]/30'
                                                        : 'text-[#b0ada3] hover:text-white'
                                                    }`}
                                                  >
                                                    🤖 IA · ProraScience
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => setQuestionsSubTab('manual')}
                                                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                                      questionsSubTab === 'manual'
                                                        ? 'bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[var(--school-accent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]'
                                                        : 'text-[#b0ada3] hover:text-white'
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
                                                    <div className="border border-[rgba(245,244,238,0.09)] rounded-xl bg-white/5 p-5 space-y-3 m-3">
                                                      <div className="font-bold text-[var(--school-accent)]">✍️ Poser une question à Manikongo</div>
                                                      <div className="text-sm text-[#c9c5bb]">
                                                        Pose ta question sur cette leçon. Tu peux la rendre publique (visible dans le forum du cours) ou privée (uniquement pour l&apos;équipe enseignante).

                                                        {currentVideoMemo?.storagePath ? (
                                                          <div className="mt-3 space-y-3">
                                                            <div className="border border-[rgba(245,244,238,0.09)] rounded-lg overflow-hidden bg-black">
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
                                                              <Button size="sm" variant="outline" className="border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5"
                                                                onClick={() => {
                                                                  const t = clipVideoRef.current ? Number(clipVideoRef.current.currentTime || 0) : 0;
                                                                  setClipStartSafe(Math.round(Math.max(0, t) * 2) / 2);
                                                                }}>
                                                                Définir IN
                                                              </Button>
                                                              <Button size="sm" variant="outline" className="border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5"
                                                                onClick={() => {
                                                                  const t = clipVideoRef.current ? Number(clipVideoRef.current.currentTime || 0) : 0;
                                                                  setClipEndSafe(Math.round(Math.max(0, t) * 2) / 2);
                                                                }}>
                                                                Définir OUT
                                                              </Button>
                                                              <Button size="sm" className="bg-[var(--school-accent)] text-black hover:brightness-110 font-bold"
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
                                                                <div className="text-xs text-[#b0ada3]">Navigation visuelle</div>
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
                                                          <div className="mt-3 text-xs text-[#b0ada3]">
                                                            La sélection visuelle IN/OUT est disponible pour les vidéos uploadées (lecteur HTML5). Pour YouTube/Vimeo, utilise les champs ci-dessous.
                                                          </div>
                                                        )}
                                                      </div>

                                                      <div className="text-xs text-[#b0ada3]">
                                                        {questionStatus === 'loading' ? 'Envoi…'
                                                          : questionStatus === 'error' ? "Erreur: impossible d'envoyer la question."
                                                          : questionStatus === 'sent' ? 'Question envoyée.'
                                                          : ''}
                                                      </div>

                                                      <div className="flex items-center gap-3">
                                                        <label className="text-sm text-[#c9c5bb] flex items-center gap-2">
                                                          <input type="radio" name="question_visibility_modal" checked={questionIsPublic} onChange={() => setQuestionIsPublic(true)} />
                                                          Publique
                                                        </label>
                                                        <label className="text-sm text-[#c9c5bb] flex items-center gap-2">
                                                          <input type="radio" name="question_visibility_modal" checked={!questionIsPublic} onChange={() => setQuestionIsPublic(false)} />
                                                          Privée
                                                        </label>
                                                      </div>

                                                      <div className="border border-[rgba(245,244,238,0.09)] rounded-lg p-3 bg-black/20">
                                                        <div className="text-xs text-[#b0ada3] uppercase tracking-wider">Séquence (clip)</div>
                                                        <div className="text-sm text-[#c9c5bb] mt-1">Référence une séquence de la vidéo (en secondes). Optionnel.</div>
                                                        <div className="grid grid-cols-2 gap-3 mt-3">
                                                          <div className="space-y-1">
                                                            <div className="text-xs text-[#b0ada3]">Début (s)</div>
                                                            <input type="number" min="0" step="0.5" value={questionClipStart} onChange={(e) => setClipStartSafe(e.target.value)}
                                                              className="w-full px-3 py-2 rounded bg-[#262624] border border-[rgba(245,244,238,0.09)] text-white" placeholder="ex: 12" />
                                                          </div>
                                                          <div className="space-y-1">
                                                            <div className="text-xs text-[#b0ada3]">Fin (s)</div>
                                                            <input type="number" min="0" step="0.5" value={questionClipEnd} onChange={(e) => setClipEndSafe(e.target.value)}
                                                              className="w-full px-3 py-2 rounded bg-[#262624] border border-[rgba(245,244,238,0.09)] text-white" placeholder="ex: 32" />
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
                                                        className="bg-[#262624] border-[rgba(245,244,238,0.09)] min-h-[180px] text-white"
                                                        placeholder="Écris ta question ici..."
                                                      />

                                                      {selectedMentions.length > 0 ? (
                                                        <div className="flex flex-wrap gap-2">
                                                          {selectedMentions.map((m) => (
                                                            <button key={m.id} type="button"
                                                              onClick={() => setSelectedMentions((prev) => prev.filter((x) => x.id !== m.id))}
                                                              className="px-2 py-1 rounded bg-white/10 border border-[rgba(245,244,238,0.09)] text-xs text-white hover:bg-white/15"
                                                              title="Cliquer pour retirer">
                                                              @{m.name}
                                                            </button>
                                                          ))}
                                                        </div>
                                                      ) : null}

                                                      {mentionQuery !== '' ? (
                                                        <div className="border border-[rgba(245,244,238,0.09)] rounded-lg bg-[#262624] overflow-hidden">
                                                          <div className="px-3 py-2 text-xs text-[#b0ada3] border-b border-[rgba(245,244,238,0.09)]">Mentionner un prof / admin</div>
                                                          {mentionLoading ? (
                                                            <div className="px-3 py-2 text-sm text-[#b0ada3]">Recherche…</div>
                                                          ) : mentionCandidates.length === 0 ? (
                                                            <div className="px-3 py-2 text-sm text-[#b0ada3]">Aucun résultat</div>
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
                                                                  <div className="text-[10px] text-[#b0ada3]">{c.role}</div>
                                                                </button>
                                                              ))}
                                                            </div>
                                                          )}
                                                        </div>
                                                      ) : null}

                                                      <div className="border border-[rgba(245,244,238,0.09)] rounded-lg p-3 bg-black/20">
                                                        <div className="text-xs text-[#b0ada3] uppercase tracking-wider">Mes questions sur cette vidéo</div>
                                                        {myQuestionsLoading ? (
                                                          <div className="text-sm text-[#b0ada3] mt-2">Chargement…</div>
                                                        ) : myQuestions.length === 0 ? (
                                                          <div className="text-sm text-[#b0ada3] mt-2">Aucune question pour l&apos;instant.</div>
                                                        ) : (
                                                          <div className="mt-3 space-y-2">
                                                            {myQuestions.map((q) => {
                                                              const editable = canEditQuestion(q.created_at);
                                                              const shareUrl = formationForumBase ? `${window.location.origin}${formationForumBase}?questionId=${q.id}` : '';
                                                              return (
                                                                <div key={q.id} className="border border-[rgba(245,244,238,0.09)] rounded-lg p-3 bg-[#262624]">
                                                                  <div className="text-xs text-[#82807a]">{new Date(q.created_at).toLocaleString()}</div>
                                                                  <div className="text-sm text-gray-200 whitespace-pre-wrap mt-1">{q.question}</div>
                                                                  <div className="text-xs text-[#b0ada3] mt-1">Séquence: {q.clip_start_seconds ?? '—'}s → {q.clip_end_seconds ?? '—'}s</div>
                                                                  <div className="flex flex-wrap items-center justify-end gap-2 mt-3">
                                                                    <Button size="sm" variant="outline" className="border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5"
                                                                      onClick={async () => { if (!shareUrl) return; try { await navigator.clipboard.writeText(shareUrl); setQuestionToast('Lien copié.'); } catch { setQuestionToast('Impossible de copier.'); } }}>
                                                                      Partager
                                                                    </Button>
                                                                    <Button size="sm" variant="outline" className="border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5" disabled={!editable}
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
                                                          className="border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5">
                                                          ← Retour IA
                                                        </Button>
                                                        <Button onClick={submitQuestion}
                                                          disabled={questionSending || !String(questionText || '').trim()}
                                                          className="bg-[var(--school-accent)] text-black hover:brightness-110 font-bold">
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
                          <div className="border border-[rgba(245,244,238,0.09)] rounded-xl bg-white/5 p-5 space-y-3">
                            <div className="font-bold">Cahier de synthèse</div>
                            <div className="text-sm text-[#c9c5bb]">Qu'est-ce que tu as retenu ? Écris avec tes mots.</div>
                            <div className="text-xs text-[#b0ada3]">
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
                            <div className={notesWordCount >= MIN_NOTES_WORDS ? 'text-xs text-green-400' : 'text-xs text-[#b0ada3]'}>
                              {notesWordCount}/{MIN_NOTES_WORDS} mots
                            </div>
                            <Textarea
                              value={notesText}
                              onChange={(e) => setNotesText(e.target.value)}
                              className="bg-[#262624] border-[rgba(245,244,238,0.09)] min-h-[220px] text-white"
                              placeholder="Écris ici..."
                            />
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                onClick={() => setActivePanel('video')}
                                className="border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5"
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
                                    ? 'border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5'
                                    : 'border-[rgba(245,244,238,0.09)] text-white/40 opacity-60 cursor-not-allowed'
                                }
                              >
                                J'ai une question
                              </Button>
                              <Button
                                onClick={saveNotes}
                                disabled={notesSaving}
                                className="bg-[var(--school-accent)] text-black hover:brightness-110 font-bold"
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
                          <div className="border border-[rgba(245,244,238,0.09)] rounded-xl bg-white/5 p-5 space-y-3">
                            <div className="font-bold">Poser une question</div>
                            <div className="text-sm text-[#c9c5bb]">
                              Pose ta question sur cette leçon. Tu peux la rendre publique (visible dans le forum du cours) ou privée (uniquement pour l'équipe enseignante).

                              {currentVideoMemo?.storagePath ? (
                                <div className="mt-3 space-y-3">
                                  <div className="border border-[rgba(245,244,238,0.09)] rounded-lg overflow-hidden bg-black">
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
                                      className="border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5"
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
                                      className="border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5"
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
                                      className="bg-[var(--school-accent)] text-black hover:brightness-110 font-bold"
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
                                      <div className="text-xs text-[#b0ada3]">Navigation visuelle</div>
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
                                <div className="mt-3 text-xs text-[#b0ada3]">
                                  La sélection visuelle IN/OUT est disponible pour les vidéos uploadées (lecteur HTML5). Pour YouTube/Vimeo, utilise les champs ci-dessous.
                                </div>
                              )}

                            </div>
                            <div className="text-xs text-[#b0ada3]">
                              {questionStatus === 'loading'
                                ? 'Envoi…'
                                : questionStatus === 'error'
                                  ? "Erreur: impossible d'envoyer la question."
                                  : questionStatus === 'sent'
                                    ? 'Question envoyée.'
                                    : ''}
                            </div>
                            <div className="flex items-center gap-3">
                              <label className="text-sm text-[#c9c5bb] flex items-center gap-2">
                                <input
                                  type="radio"
                                  name="question_visibility"
                                  checked={questionIsPublic}
                                  onChange={() => setQuestionIsPublic(true)}
                                />
                                Publique
                              </label>
                              <label className="text-sm text-[#c9c5bb] flex items-center gap-2">
                                <input
                                  type="radio"
                                  name="question_visibility"
                                  checked={!questionIsPublic}
                                  onChange={() => setQuestionIsPublic(false)}
                                />
                                Privée
                              </label>
                            </div>

                            <div className="border border-[rgba(245,244,238,0.09)] rounded-lg p-3 bg-black/20">
                              <div className="text-xs text-[#b0ada3] uppercase tracking-wider">Séquence (clip)</div>
                              <div className="text-sm text-[#c9c5bb] mt-1">
                                Référence une séquence de la vidéo (en secondes). Optionnel.
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                <div className="space-y-1">
                                  <div className="text-xs text-[#b0ada3]">Début (s)</div>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={questionClipStart}
                                    onChange={(e) => setClipStartSafe(e.target.value)}
                                    className="w-full px-3 py-2 rounded bg-[#262624] border border-[rgba(245,244,238,0.09)] text-white"
                                    placeholder="ex: 12"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <div className="text-xs text-[#b0ada3]">Fin (s)</div>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={questionClipEnd}
                                    onChange={(e) => setClipEndSafe(e.target.value)}
                                    className="w-full px-3 py-2 rounded bg-[#262624] border border-[rgba(245,244,238,0.09)] text-white"
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
                              className="bg-[#262624] border-[rgba(245,244,238,0.09)] min-h-[180px] text-white"
                              placeholder="Écris ta question ici..."
                            />

                            {selectedMentions.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {selectedMentions.map((m) => (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setSelectedMentions((prev) => prev.filter((x) => x.id !== m.id))}
                                    className="px-2 py-1 rounded bg-white/10 border border-[rgba(245,244,238,0.09)] text-xs text-white hover:bg-white/15"
                                    title="Cliquer pour retirer"
                                  >
                                    @{m.name}
                                  </button>
                                ))}
                              </div>
                            ) : null}

                            {mentionQuery !== '' ? (
                              <div className="border border-[rgba(245,244,238,0.09)] rounded-lg bg-[#262624] overflow-hidden">
                                <div className="px-3 py-2 text-xs text-[#b0ada3] border-b border-[rgba(245,244,238,0.09)]">
                                  Mentionner un prof / admin
                                </div>
                                {mentionLoading ? (
                                  <div className="px-3 py-2 text-sm text-[#b0ada3]">Recherche…</div>
                                ) : mentionCandidates.length === 0 ? (
                                  <div className="px-3 py-2 text-sm text-[#b0ada3]">Aucun résultat</div>
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
                                        <div className="text-[10px] text-[#b0ada3]">{c.role}</div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : null}

                            <div className="border border-[rgba(245,244,238,0.09)] rounded-lg p-3 bg-black/20">
                              <div className="text-xs text-[#b0ada3] uppercase tracking-wider">Mes questions sur cette vidéo</div>
                              {myQuestionsLoading ? (
                                <div className="text-sm text-[#b0ada3] mt-2">Chargement…</div>
                              ) : myQuestions.length === 0 ? (
                                <div className="text-sm text-[#b0ada3] mt-2">Aucune question pour l'instant.</div>
                              ) : (
                                <div className="mt-3 space-y-2">
                                  {myQuestions.map((q) => {
                                    const editable = canEditQuestion(q.created_at);
                                    const shareUrl = formationForumBase ? `${window.location.origin}${formationForumBase}?questionId=${q.id}` : '';
                                    return (
                                      <div key={q.id} className="border border-[rgba(245,244,238,0.09)] rounded-lg p-3 bg-[#262624]">
                                        <div className="text-xs text-[#82807a]">{new Date(q.created_at).toLocaleString()}</div>
                                        <div className="text-sm text-gray-200 whitespace-pre-wrap mt-1">{q.question}</div>
                                        <div className="text-xs text-[#b0ada3] mt-1">
                                          Séquence: {q.clip_start_seconds ?? '—'}s → {q.clip_end_seconds ?? '—'}s
                                        </div>
                                        <div className="flex flex-wrap items-center justify-end gap-2 mt-3">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5"
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
                                            className="border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5"
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
                                className="border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5"
                              >
                                Retour
                              </Button>
                              <Button
                                onClick={submitQuestion}
                                disabled={questionSending || !String(questionText || '').trim()}
                                className="bg-[var(--school-accent)] text-black hover:brightness-110 font-bold"
                              >
                                {questionSending ? 'Envoi...' : editingQuestionId ? 'Enregistrer' : 'Envoyer'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {activePanel === 'discussion' ? (
                        <div className="max-w-3xl mx-auto">
                          <div className="border border-[rgba(245,244,238,0.09)] rounded-xl bg-white/5 p-5 space-y-4">
                            <div>
                              <div className="font-bold flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-[var(--school-accent)]" />
                                Discussion de la vidéo
                              </div>
                              <div className="text-sm text-[#c9c5bb] mt-1">
                                Échange avec les autres inscrits et l'équipe enseignante autour de cette vidéo. Les messages restent visibles uniquement par les personnes ayant accès au cours.
                              </div>
                            </div>

                            {!discussionVideoId ? (
                              <div className="text-sm text-[#b0ada3] border border-[rgba(245,244,238,0.09)] rounded-lg bg-black/20 p-4">
                                La discussion sera disponible dès que cette vidéo sera enregistrée dans le cours.
                              </div>
                            ) : discussionError ? (
                              <div className="text-sm text-[#b0ada3] border border-[rgba(245,244,238,0.09)] rounded-lg bg-black/20 p-4">
                                Discussion momentanément indisponible. Tu dois être inscrit à ce cours pour y participer.
                              </div>
                            ) : (
                              <>
                                <div className="border border-[rgba(245,244,238,0.09)] rounded-lg bg-black/20 p-3 max-h-[320px] overflow-auto space-y-3">
                                  {discussionLoading && !discussionMessages.length ? (
                                    <div className="text-xs text-[#82807a] py-6 text-center">Chargement de la discussion…</div>
                                  ) : !discussionMessages.length ? (
                                    <div className="text-xs text-[#82807a] py-6 text-center">
                                      Aucun message pour l'instant. Lance la discussion !
                                    </div>
                                  ) : (
                                    discussionMessages.map((m) => {
                                      const mine = m.sender_id && m.sender_id === user?.id;
                                      return (
                                        <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                                          <div
                                            className={cn(
                                              'max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
                                              mine
                                                ? 'bg-[var(--school-accent)] text-black'
                                                : 'bg-white/10 text-white',
                                            )}
                                          >
                                            {m.content}
                                          </div>
                                          {m.created_at ? (
                                            <div className="text-[10px] text-[#82807a] mt-1 px-1">
                                              {new Date(m.created_at).toLocaleString()}
                                            </div>
                                          ) : null}
                                        </div>
                                      );
                                    })
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <Textarea
                                    value={discussionText}
                                    onChange={(e) => setDiscussionText(e.target.value)}
                                    className="bg-[#262624] border-[rgba(245,244,238,0.09)] min-h-[90px] text-white"
                                    placeholder={discussionTopic?.id ? 'Écris ton message…' : 'Ouverture de la discussion…'}
                                    disabled={!discussionTopic?.id || discussionTopic?.status === 'closed'}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                        e.preventDefault();
                                        handleSendDiscussion();
                                      }
                                    }}
                                  />
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="text-[11px] text-[#82807a]">
                                      {discussionTopic?.status === 'closed'
                                        ? 'Discussion clôturée.'
                                        : 'Astuce : Cmd/Ctrl + Entrée pour envoyer.'}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="outline"
                                        onClick={() => setActivePanel('video')}
                                        className="border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5"
                                      >
                                        Retour
                                      </Button>
                                      <Button
                                        onClick={handleSendDiscussion}
                                        disabled={!discussionTopic?.id || discussionSending || !discussionText.trim() || discussionTopic?.status === 'closed'}
                                        className="bg-[var(--school-accent)] text-black hover:brightness-110 font-bold"
                                      >
                                        {discussionSending ? 'Envoi…' : 'Envoyer'}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="h-20" />
                  </div>

                  {!panelOpen && (
                    <button type="button" onClick={() => setPanelOpen(true)} className="hidden md:flex absolute top-1/2 right-0 -translate-y-1/2 z-30 items-center gap-1.5 pl-3 pr-2 py-5 rounded-l-2xl bg-[#141318]/70 backdrop-blur-md border border-r-0 border-[rgba(245,244,238,0.09)] text-[var(--school-accent)] hover:bg-[#141318]/90 transition-colors" aria-label="Ouvrir le programme">
                      <ChevronRight className="w-4 h-4 rotate-180" />
                      <span className="text-[10px] tracking-[0.16em]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>PROGRAMME</span>
                    </button>
                  )}
                  <div className={cn(
                    "hidden md:flex flex-col absolute top-0 right-0 h-full w-[380px] lg:w-[420px] bg-[#141318]/95 backdrop-blur-2xl border-l border-[rgba(245,244,238,0.09)] z-40 shadow-2xl transition-transform duration-300 ease-out",
                    panelOpen ? "translate-x-0" : "translate-x-full"
                  )}>
                    <button type="button" onClick={() => setPanelOpen(false)} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center text-[#c9c5bb] hover:text-white hover:bg-white/10 transition-colors" aria-label="Fermer le panneau">
                      <ChevronRight className="w-5 h-5" />
                    </button>
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

                <div className="shrink-0 border-t border-[rgba(245,244,238,0.09)] bg-[#262624] px-3 md:px-6 py-3 flex items-center justify-between gap-3">
                  <div className="text-xs text-[#b0ada3] truncate">
                    {activePanel === 'video'
                      ? 'Vidéo'
                      : activePanel === 'presentation'
                        ? 'Présentation'
                        : activePanel === 'quiz'
                          ? 'Quiz'
                          : activePanel === 'questions'
                            ? 'Question'
                            : activePanel === 'discussion'
                              ? 'Discussion'
                              : 'Cahier'}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={activePanel === 'video' ? 'secondary' : 'outline'}
                      onClick={() => setActivePanel('video')}
                      className={activePanel === 'video' ? 'bg-white/10 text-white' : 'border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5'}
                    >
                      Vidéo
                    </Button>
                    <Button
                      size="sm"
                      variant={activePanel === 'presentation' ? 'secondary' : 'outline'}
                      disabled={!canShowPresentation}
                      onClick={() => setActivePanel('presentation')}
                      className={activePanel === 'presentation' ? 'bg-white/10 text-white' : 'border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5'}
                    >
                      Présentation
                    </Button>
                    <Button
                      size="sm"
                      variant={activePanel === 'quiz' ? 'secondary' : 'outline'}
                      disabled={!canShowQuiz}
                      onClick={() => setActivePanel('quiz')}
                      className={activePanel === 'quiz' ? 'bg-white/10 text-white' : 'border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5'}
                    >
                      Quiz
                    </Button>
                    <Button
                      size="sm"
                      variant={activePanel === 'notes' ? 'secondary' : 'outline'}
                      onClick={() => setActivePanel('notes')}
                      className={activePanel === 'notes' ? 'bg-white/10 text-white' : 'border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5'}
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
                            ? 'border-[rgba(245,244,238,0.09)] text-white/40 opacity-60 cursor-not-allowed'
                            : 'border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5'
                      }
                    >
                      Question
                    </Button>
                    <Button
                      size="sm"
                      variant={activePanel === 'discussion' ? 'secondary' : 'outline'}
                      onClick={() => {
                        if (!questionsUnlocked) {
                          setQuestionToast(getQuestionsLockedReason());
                          return;
                        }
                        setActivePanel('discussion');
                      }}
                      aria-disabled={!questionsUnlocked}
                      className={
                        activePanel === 'discussion'
                          ? 'bg-white/10 text-white'
                          : !questionsUnlocked
                            ? 'border-[rgba(245,244,238,0.09)] text-white/40 opacity-60 cursor-not-allowed'
                            : 'border-[rgba(245,244,238,0.09)] text-white hover:bg-white/5'
                      }
                    >
                      Discussion
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
              <div className="max-w-3xl mx-auto border border-[rgba(245,244,238,0.09)] rounded-lg p-4 bg-white/5 space-y-3">
                <div className="text-sm text-[#c9c5bb]">{activeItem?.payload?.questions?.length || 0} questions</div>
                <div className="space-y-2">
                  {(activeItem?.payload?.questions || []).slice(0, 5).map((q, idx) => (
                    <div key={idx} className="border border-[rgba(245,244,238,0.09)] rounded p-3 bg-black/20">
                      <div className="text-sm font-semibold">{idx + 1}. {q?.question || q?.title || 'Question'}</div>
                    </div>
                  ))}
                </div>
                {(activeItem?.payload?.questions || []).length > 5 ? (
                  <div className="text-xs text-[#82807a]">+ {(activeItem.payload.questions.length - 5)} autres questions...</div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="p-6 text-[#b0ada3]">Aucun contenu.</div>
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