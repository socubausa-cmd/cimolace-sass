import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MessageCircle,
  PlayCircle,
  Loader2,
  Plus,
  Search,
  Filter,
  Heart,
  MessageSquare,
  Clock,
  TrendingUp,
  ChevronDown,
  Bookmark,
  X,
  MoreHorizontal,
  Tag,
  Video,
  FileText,
  Bell,
  CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import CimolacePremiumShell from '@/components/cimolace/CimolacePremiumShell';
import ForumNotificationsDropdown from '@/components/forum/ForumNotificationsDropdown';
import { useForumFavorites, useForumVotes } from '@/hooks/useForumNotifications';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/hextaui/Accordion';

// Types
/**
 * @typedef {Object} ForumQuestion
 * @property {string} id
 * @property {string} formation_id
 * @property {string} question
 * @property {string} [video_storage_path]
 * @property {string} [video_url]
 * @property {number} [clip_start_seconds]
 * @property {string} [clip_end_seconds]
 * @property {string} created_at
 * @property {string} [student_id]
 * @property {string} [author_name]
 * @property {string[]} [tags]
 */

/**
 * @typedef {Object} FilterState
 * @property {string} search
 * @property {string} sortBy - 'newest' | 'popular' | 'unanswered'
 * @property {string} formationFilter
 * @property {string[]} selectedTags
 * @property {boolean} hasClipOnly
 */

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
};

const formatRelativeTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  return formatDate(value);
};

/**
 * Forum Redesign - Version senior avec shell premium et HextaUI Accordion
 * 
 * Features:
 * - Shell CimolacePremium cohérent
 * - Filtres organisés en Accordion (HextaUI)
 * - Système de favoris local
 * - Création rapide de sujet
 * - Tags et catégories
 * - Preview réponses
 * - Tri avancé
 */
export default function StudentForumRedesign({
  forumBasePath = '/student-school-life/forum',
  formationForumHref,
}) {
  const navigate = useNavigate();

  // Data states
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [answersCount, setAnswersCount] = useState({});
  const [formationTitles, setFormationTitles] = useState({});
  const [availableTags, setAvailableTags] = useState([]);

  // Filter states
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'popular' | 'unanswered'
  const [formationFilter, setFormationFilter] = useState('all');
  const [selectedTags, setSelectedTags] = useState([]);
  const [hasClipOnly, setHasClipOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Current user
  const [currentUser, setCurrentUser] = useState(null);

  // Real hooks (DB backed)
  const { favorites, toggleFavorite: toggleFavDB, isFav } = useForumFavorites(currentUser?.id);
  const { votes, vote: doVote } = useForumVotes(currentUser?.id);

  // Clip player state
  const [openClipQuestionId, setOpenClipQuestionId] = useState(null);
  const [clipUrl, setClipUrl] = useState('');
  const clipVideoRef = useRef(null);
  const clipStopAtRef = useRef(null);

  // Load current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });
  }, []);

  // Load data
  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        // Fetch questions with more details (including pinned, views, votes)
        const { data: qRows } = await supabase
          .from('formation_student_questions')
          .select('id,formation_id,question,video_storage_path,video_url,clip_start_seconds,clip_end_seconds,created_at,student_id,author_name,tags,content,is_pinned,view_count,vote_count,reply_count,accepted_answer_id,status')
          .eq('is_public', true)
          .order('is_pinned', { ascending: false }) // Épinglées d'abord
          .order('created_at', { ascending: false })
          .limit(100);

        const questions = Array.isArray(qRows) ? qRows : [];
        if (!alive) return;

        // Enrich with mock tags if missing
        const enrichedQuestions = questions.map((q) => ({
          ...q,
          tags: q.tags || extractTagsFromQuestion(q.question),
          author_name: q.author_name || 'Élève anonyme',
        }));

        setRows(enrichedQuestions);

        // Extract all tags
        const allTags = [...new Set(enrichedQuestions.flatMap((q) => q.tags || []))];
        setAvailableTags(allTags.slice(0, 20)); // Limit displayed tags

        // Fetch answer counts
        const qIds = questions.map((q) => q.id).filter(Boolean);
        if (qIds.length > 0) {
          const { data: answers } = await supabase
            .from('formation_question_answers')
            .select('question_id,id,is_instructor_answer')
            .in('question_id', qIds)
            .eq('is_public', true);

          if (!alive) return;

          const grouped = {};
          const hasInstructorReply = {};

          (answers || []).forEach((a) => {
            const id = a.question_id;
            grouped[id] = (grouped[id] || 0) + 1;
            if (a.is_instructor_answer) {
              hasInstructorReply[id] = true;
            }
          });

          // Merge instructor info
          Object.keys(grouped).forEach((id) => {
            grouped[id] = {
              count: grouped[id],
              hasInstructor: hasInstructorReply[id] || false,
            };
          });

          setAnswersCount(grouped);
        }

        // Fetch formation titles
        const formationIds = [...new Set(questions.map((q) => q.formation_id).filter(Boolean))];
        if (formationIds.length > 0) {
          const { data: formations } = await supabase
            .from('formations')
            .select('id,title,color')
            .in('id', formationIds);

          if (!alive) return;
          const map = {};
          (formations || []).forEach((f) => {
            map[f.id] = { title: f.title || 'Formation', color: f.color };
          });
          setFormationTitles(map);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();

    // Real-time subscription for new questions
    const channel = supabase
      .channel('forum-new-questions')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'formation_student_questions',
        filter: 'is_public=eq.true',
      }, (payload) => {
        setRows(prev => [payload.new, ...prev]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'formation_student_questions',
      }, (payload) => {
        setRows(prev => prev.map(q => q.id === payload.new.id ? payload.new : q));
      })
      .subscribe();

    return () => { 
      alive = false; 
      supabase.removeChannel(channel);
    };
  }, []);

  // Extract keywords as tags from question text
  const extractTagsFromQuestion = (question) => {
    if (!question) return [];
    const keywords = [
      'mécanique', 'électricité', 'chimie', 'physique', 'math',
      'programmation', 'design', 'marketing', 'gestion', 'comptabilité',
      'examen', 'concours', 'projet', 'stage', 'mémoire',
      'aide', 'urgent', 'question', 'clarification',
    ];
    const lowerQ = question.toLowerCase();
    return keywords.filter((kw) => lowerQ.includes(kw)).slice(0, 3);
  };


  // Toggle tag selection
  const toggleTag = useCallback((tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  // Filter and sort entries
  const entries = useMemo(() => {
    let list = [...rows];

    // Text search
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((row) =>
        String(row?.question || '').toLowerCase().includes(q) ||
        String(row?.author_name || '').toLowerCase().includes(q)
      );
    }

    // Formation filter
    if (formationFilter !== 'all') {
      list = list.filter((row) => row.formation_id === formationFilter);
    }

    // Tags filter
    if (selectedTags.length > 0) {
      list = list.filter((row) =>
        selectedTags.some((tag) => (row.tags || []).includes(tag))
      );
    }

    // Has clip filter
    if (hasClipOnly) {
      list = list.filter((row) =>
        Number.isFinite(Number(row.clip_start_seconds)) ||
        Number.isFinite(Number(row.clip_end_seconds))
      );
    }

    // Sort
    switch (sortBy) {
      case 'popular':
        list.sort((a, b) => {
          const countA = answersCount[a.id]?.count || 0;
          const countB = answersCount[b.id]?.count || 0;
          return countB - countA;
        });
        break;
      case 'unanswered':
        list.sort((a, b) => {
          const countA = answersCount[a.id]?.count || 0;
          const countB = answersCount[b.id]?.count || 0;
          return countA - countB;
        });
        break;
      case 'newest':
      default:
        // Already sorted by created_at desc
        break;
    }

    return list;
  }, [rows, search, formationFilter, selectedTags, hasClipOnly, sortBy, answersCount]);

  // Favorited entries (from DB)
  const favoriteEntries = useMemo(() => {
    return rows.filter((q) => favorites?.includes(q.id));
  }, [rows, favorites]);

  // Build formation href
  const buildFormationHref = useMemo(() => {
    return (formationId, questionId) => {
      if (formationForumHref) return formationForumHref(formationId, questionId);
      const q = questionId ? `?questionId=${encodeURIComponent(questionId)}` : '';
      return `${forumBasePath}/formation/${formationId}${q}`;
    };
  }, [forumBasePath, formationForumHref]);

  // Play clip handler
  const handlePlayClip = async (q) => {
    const canPlayClip = Boolean(q.video_storage_path || q.video_url);
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
  };

  // Clear all filters
  const clearFilters = () => {
    setSearch('');
    setFormationFilter('all');
    setSelectedTags([]);
    setHasClipOnly(false);
    setSortBy('newest');
  };

  const hasActiveFilters =
    search || formationFilter !== 'all' || selectedTags.length > 0 || hasClipOnly || sortBy !== 'newest';

  return (
    <CimolacePremiumShell>
      <div className="min-h-screen pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-bold text-[#0a0a0f] tracking-tight">
                  Forum Communauté
                </h1>
                <p className="text-[#6e6e73] mt-1">
                  Questions, réponses et échanges entre élèves et instructeurs
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* New Question Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`${forumBasePath}/new`)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#0a0a0f] text-white rounded-lg font-medium hover:bg-[#5b3df5] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Nouvelle question
                </motion.button>

                {/* Notifications */}
                {currentUser && (
                  <ForumNotificationsDropdown userId={currentUser.id} />
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 px-4 py-2 bg-[#f5f5f7] rounded-lg">
                  <span className="text-sm text-[#6e6e73]">
                    <span className="font-semibold text-[#0a0a0f]">{entries.length}</span> sujets
                  </span>
                  <span className="w-px h-4 bg-[#e5e5ea]" />
                  <span className="text-sm text-[#6e6e73]">
                    <span className="font-semibold text-[#0a0a0f]">{favoriteEntries.length}</span> favoris
                  </span>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1 max-w-xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6e6e73]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher une question, un sujet..."
                  className="w-full pl-10 pr-4 py-3 bg-white border border-[#e5e5ea] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5b3df5]/20 focus:border-[#5b3df5] transition-all"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-[#f5f5f7] rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-[#6e6e73]" />
                  </button>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all',
                  showFilters || hasActiveFilters
                    ? 'bg-[#5b3df5] text-white'
                    : 'bg-[#f5f5f7] text-[#0a0a0f] hover:bg-[#e5e5ea]'
                )}
              >
                <Filter className="w-4 h-4" />
                Filtres
                {hasActiveFilters && (
                  <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">
                    {[formationFilter !== 'all', selectedTags.length > 0, hasClipOnly].filter(Boolean).length}
                  </span>
                )}
              </motion.button>
            </div>

            {/* Filters Accordion */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.04, 0.62, 0.23, 0.98] }}
                  className="overflow-hidden"
                >
                  <div className="bg-[#f5f5f7] rounded-xl p-4 mb-4">
                    <Accordion type="multiple" defaultValue={['sort', 'formation']}>
                      {/* Sort */}
                      <AccordionItem value="sort">
                        <AccordionTrigger value="sort">Trier par</AccordionTrigger>
                        <AccordionContent value="sort">
                          <div className="flex flex-wrap gap-2">
                            {[
                              { id: 'newest', label: 'Plus récents', icon: Clock },
                              { id: 'popular', label: 'Plus populaires', icon: TrendingUp },
                              { id: 'unanswered', label: 'Sans réponse', icon: MessageSquare },
                            ].map((option) => (
                              <button
                                key={option.id}
                                onClick={() => setSortBy(option.id)}
                                className={cn(
                                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                                  sortBy === option.id
                                    ? 'bg-[#0a0a0f] text-white'
                                    : 'bg-white text-[#6e6e73] hover:text-[#0a0a0f]'
                                )}
                              >
                                <option.icon className="w-4 h-4" />
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {/* Formation */}
                      <AccordionItem value="formation">
                        <AccordionTrigger value="formation">Formation</AccordionTrigger>
                        <AccordionContent value="formation">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => setFormationFilter('all')}
                              className={cn(
                                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                                formationFilter === 'all'
                                  ? 'bg-[#0a0a0f] text-white'
                                  : 'bg-white text-[#6e6e73] hover:text-[#0a0a0f]'
                              )}
                            >
                              Toutes
                            </button>
                            {Object.entries(formationTitles).map(([id, info]) => (
                              <button
                                key={id}
                                onClick={() => setFormationFilter(id)}
                                className={cn(
                                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                                  formationFilter === id
                                    ? 'bg-[#5b3df5] text-white'
                                    : 'bg-white text-[#6e6e73] hover:text-[#0a0a0f]'
                                )}
                              >
                                {info.title}
                              </button>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {/* Tags */}
                      {availableTags.length > 0 && (
                        <AccordionItem value="tags">
                          <AccordionTrigger value="tags">Tags</AccordionTrigger>
                          <AccordionContent value="tags">
                            <div className="flex flex-wrap gap-2">
                              {availableTags.map((tag) => (
                                <button
                                  key={tag}
                                  onClick={() => toggleTag(tag)}
                                  className={cn(
                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all',
                                    selectedTags.includes(tag)
                                      ? 'bg-[#5b3df5] text-white'
                                      : 'bg-white text-[#6e6e73] hover:text-[#0a0a0f] border border-[#e5e5ea]'
                                  )}
                                >
                                  <Tag className="w-3 h-3" />
                                  {tag}
                                </button>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {/* Clip filter */}
                      <AccordionItem value="media">
                        <AccordionTrigger value="media">Médias</AccordionTrigger>
                        <AccordionContent value="media">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={hasClipOnly}
                              onChange={(e) => setHasClipOnly(e.target.checked)}
                              className="w-4 h-4 rounded border-[#e5e5ea] text-[#5b3df5] focus:ring-[#5b3df5]"
                            />
                            <span className="text-sm text-[#424245]">Uniquement les questions avec clip vidéo</span>
                          </label>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    {/* Clear filters */}
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="mt-4 text-sm text-[#5b3df5] hover:underline"
                      >
                        Réinitialiser tous les filtres
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Active filters pills */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2">
                {search && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#5b3df5]/10 text-[#5b3df5] rounded-full text-sm">
                    Recherche: "{search}"
                    <button onClick={() => setSearch('')} className="hover:bg-[#5b3df5]/20 rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {formationFilter !== 'all' && formationTitles[formationFilter] && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#5b3df5]/10 text-[#5b3df5] rounded-full text-sm">
                    {formationTitles[formationFilter].title}
                    <button onClick={() => setFormationFilter('all')} className="hover:bg-[#5b3df5]/20 rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {selectedTags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-[#2cc275]/10 text-[#2cc275] rounded-full text-sm">
                    #{tag}
                    <button onClick={() => toggleTag(tag)} className="hover:bg-[#2cc275]/20 rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {hasClipOnly && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#ff6b4a]/10 text-[#ff6b4a] rounded-full text-sm">
                    <Video className="w-3 h-3" />
                    Avec clip
                    <button onClick={() => setHasClipOnly(false)} className="hover:bg-[#ff6b4a]/20 rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Questions List */}
            <div className="lg:col-span-2 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[#5b3df5]" />
                </div>
              ) : entries.length === 0 ? (
                <div className="text-center py-12 bg-[#f5f5f7] rounded-xl">
                  <MessageCircle className="w-12 h-12 text-[#e5e5ea] mx-auto mb-4" />
                  <p className="text-[#6e6e73]">Aucune question ne correspond à vos critères.</p>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="mt-4 text-[#5b3df5] hover:underline text-sm"
                    >
                      Réinitialiser les filtres
                    </button>
                  )}
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {entries.map((q, idx) => {
                    const hasClip = Number.isFinite(Number(q.clip_start_seconds)) || Number.isFinite(Number(q.clip_end_seconds));
                    const canPlayClip = Boolean(q.video_storage_path || q.video_url);
                    const answerInfo = answersCount[q.id] || { count: 0, hasInstructor: false };
                    const isFavItem = isFav(q.id);
                    const userVote = votes[q.id] || 0;
                    const formationInfo = formationTitles[q.formation_id];

                    return (
                      <motion.article
                        key={q.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-white border border-[#e5e5ea] rounded-xl p-5 hover:border-[#5b3df5]/30 hover:shadow-lg hover:shadow-[#5b3df5]/5 transition-all group"
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex items-center gap-3">
                            {/* Avatar placeholder */}
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5b3df5] to-[#8b6dff] flex items-center justify-center text-white font-semibold text-sm">
                              {q.author_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <p className="font-medium text-[#0a0a0f] text-sm">{q.author_name}</p>
                              <div className="flex items-center gap-2 text-xs text-[#6e6e73]">
                                <span>{formatRelativeTime(q.created_at)}</span>
                                {formationInfo && (
                                  <>
                                    <span>·</span>
                                    <span className="text-[#5b3df5]">{formationInfo.title}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleFavDB(q.id)}
                              className={cn(
                                'p-2 rounded-lg transition-colors',
                                isFavItem
                                  ? 'text-red-500 bg-red-50'
                                  : 'text-[#6e6e73] hover:bg-[#f5f5f7]'
                              )}
                              title={isFavItem ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                            >
                              <Heart className={cn('w-4 h-4', isFavItem && 'fill-current')} />
                            </button>
                            <button className="p-2 text-[#6e6e73] hover:bg-[#f5f5f7] rounded-lg transition-colors">
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Content */}
                        <Link
                          to={`/student-school-life/forum/thread/${q.id}`}
                          className="block mb-3 group/link"
                        >
                          <div className="flex items-start gap-2">
                            {q.is_pinned && (
                              <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                                <Bookmark className="w-3 h-3" />
                                Épinglé
                              </span>
                            )}
                            {q.accepted_answer_id && (
                              <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                <CheckCircle2 className="w-3 h-3" />
                                Résolu
                              </span>
                            )}
                            {q.status === 'closed' && (
                              <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                                <X className="w-3 h-3" />
                                Fermé
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold text-[#0a0a0f] group-hover/link:text-[#5b3df5] transition-colors line-clamp-2 mt-2">
                            {q.question}
                          </h3>
                        </Link>

                        {/* Tags */}
                        {(q.tags || []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {(q.tags || []).map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 bg-[#f5f5f7] text-[#6e6e73] text-xs rounded-full"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Meta */}
                        <div className="flex items-center gap-4 text-sm">
                          {/* Replies - use DB reply_count */}
                          <div className={cn(
                            'flex items-center gap-1.5',
                            (q.reply_count || answerInfo.count) > 0 ? 'text-[#2cc275]' : 'text-[#6e6e73]'
                          )}>
                            <MessageSquare className="w-4 h-4" />
                            <span>{q.reply_count || answerInfo.count} réponse{(q.reply_count || answerInfo.count) !== 1 ? 's' : ''}</span>
                            {answerInfo.hasInstructor && (
                              <span className="ml-1 px-1.5 py-0.5 bg-[#2cc275]/10 text-[#2cc275] text-xs rounded-full">
                                Instructeur
                              </span>
                            )}
                          </div>

                          {/* View count */}
                          <div className="flex items-center gap-1 text-[#6e6e73]">
                            <Clock className="w-4 h-4" />
                            <span>{q.view_count || 0} vues</span>
                          </div>

                          {/* Vote count */}
                          {(q.vote_count || 0) > 0 && (
                            <div className="flex items-center gap-1 text-[#5b3df5]">
                              <TrendingUp className="w-4 h-4" />
                              <span>{q.vote_count} votes</span>
                            </div>
                          )}

                          {hasClip && (
                            <button
                              onClick={() => handlePlayClip(q)}
                              className={cn(
                                'flex items-center gap-1.5 transition-colors',
                                openClipQuestionId === q.id
                                  ? 'text-[#ff6b4a]'
                                  : 'text-[#6e6e73] hover:text-[#ff6b4a]'
                              )}
                            >
                              <PlayCircle className="w-4 h-4" />
                              <span>{openClipQuestionId === q.id ? 'Fermer' : 'Voir le clip'}</span>
                            </button>
                          )}
                        </div>

                        {/* Video player */}
                        <AnimatePresence>
                          {openClipQuestionId === q.id && clipUrl && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden mt-4"
                            >
                              <div className="rounded-lg overflow-hidden bg-black">
                                <video
                                  ref={clipVideoRef}
                                  src={clipUrl}
                                  controls
                                  className="w-full max-h-[300px]"
                                  onLoadedMetadata={(e) => {
                                    const start = Number.isFinite(Number(q.clip_start_seconds))
                                      ? Number(q.clip_start_seconds)
                                      : 0;
                                    const end = Number.isFinite(Number(q.clip_end_seconds))
                                      ? Number(q.clip_end_seconds)
                                      : start + 10;
                                    try {
                                      e.currentTarget.currentTime = start;
                                    } catch {}
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
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.article>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>

            {/* Sidebar */}
            <aside className="space-y-6">
              {/* Quick Actions */}
              <div className="bg-[#0a0a0f] rounded-xl p-5 text-white">
                <h3 className="font-semibold mb-3">Actions rapides</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => navigate(`${forumBasePath}/new`)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-left"
                  >
                    <Plus className="w-5 h-5 text-[#5b3df5]" />
                    <span>Poser une question</span>
                  </button>
                  <button
                    onClick={() => setSortBy('unanswered')}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-left"
                  >
                    <MessageSquare className="w-5 h-5 text-[#2cc275]" />
                    <span>Aider sans réponse</span>
                  </button>
                </div>
              </div>

              {/* Favorites */}
              {favoriteEntries.length > 0 && (
                <div className="bg-white border border-[#e5e5ea] rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Bookmark className="w-5 h-5 text-[#5b3df5]" />
                    <h3 className="font-semibold">Mes favoris</h3>
                    <span className="ml-auto text-xs text-[#6e6e73]">{favoriteEntries.length}</span>
                  </div>
                  <div className="space-y-3">
                    {favoriteEntries.slice(0, 5).map((q) => (
                      <Link
                        key={q.id}
                        to={buildFormationHref(q.formation_id, q.id)}
                        className="block text-sm text-[#0a0a0f] hover:text-[#5b3df5] line-clamp-2 transition-colors"
                      >
                        {q.question}
                      </Link>
                    ))}
                    {favoriteEntries.length > 5 && (
                      <button className="text-sm text-[#5b3df5] hover:underline">
                        Voir tous les favoris
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Popular Tags */}
              {availableTags.length > 0 && (
                <div className="bg-white border border-[#e5e5ea] rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Tag className="w-5 h-5 text-[#2cc275]" />
                    <h3 className="font-semibold">Tags populaires</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.slice(0, 10).map((tag) => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-sm transition-all',
                          selectedTags.includes(tag)
                            ? 'bg-[#5b3df5] text-white'
                            : 'bg-[#f5f5f7] text-[#6e6e73] hover:text-[#0a0a0f]'
                        )}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Help */}
              <div className="bg-[#f5f5f7] rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#5b3df5]/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-[#5b3df5]" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm mb-1">Comment utiliser le forum ?</h4>
                    <p className="text-xs text-[#6e6e73] leading-relaxed">
                      Posez des questions précises, ajoutez des clips vidéo pour illustrer,
                      et marquez les réponses utiles comme favorites.
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </CimolacePremiumShell>
  );
}
