import React, { useEffect, useState, useRef } from 'react';
import { DEFAULT_TENANT_SLUG } from '@/config/platform';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  MessageSquare,
  Heart,
  Share2,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  Send,
  Loader2,
  ThumbsUp,
  Flag,
  Trash2,
  Edit3,
  CornerDownRight,
  Bookmark,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import './forum-dark.css';
import ForumSommaire, { takeForumPreview } from './ForumSommaire';
import ForumConvNav from './ForumConvNav';

/**
 * Page détail d'un thread forum avec réponses
 * Features:
 * - Affichage question complète
 * - Liste réponses threadées
 * - Répondre avec éditeur
 * - Votes up/down
 * - Marquer comme solution
 * - Actions (éditer, supprimer, signaler)
 */
export default function ForumThreadPage() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const forumBase = (location.pathname.split('/forum')[0] || '') + '/forum';
  const preview = location.state?.preview;

  // Data states
  const [thread, setThread] = useState(null);
  const [replies, setReplies] = useState([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [liriLoading, setLiriLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [formation, setFormation] = useState(null);

  // Reply state
  const [replyContent, setReplyContent] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyTo, setReplyTo] = useState(null); // Pour réponses threadées

  // Votes
  const [userVotes, setUserVotes] = useState({}); // { postId: 1 | -1 }

  // UI states
  const [isFav, setIsFav] = useState(false);
  const [showActions, setShowActions] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');

  const replyTextareaRef = useRef(null);
  const paneRef = useRef(null);

  // Volet messages : remonter en haut au changement de conversation (switch instantané).
  useEffect(() => { if (paneRef.current) paneRef.current.scrollTop = 0; }, [threadId]);

  // Load thread + user
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    loadUser();
  }, []);

  // Track view
  useEffect(() => {
    if (!threadId) return;
    
    // Increment view via edge function
    fetch('/.netlify/functions/forum-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: threadId }),
    }).catch(() => {}); // Silently fail
  }, [threadId]);

  // Load thread data
  useEffect(() => {
    if (!threadId) return;
    let alive = true;

    const load = async () => {
      // Affichage OPTIMISTE : la question connue (sommaire) s'affiche instantanément.
      const pv = takeForumPreview(threadId);
      if (pv) {
        setThread(pv);
        setReplies([]);
        setRepliesLoading(true);
        setLoading(false);
      } else {
        setLoading(true);
      }
      try {
        // Round 1 : question + réponses EN PARALLÈLE.
        const [qRes, aRes] = await Promise.all([
          supabase.from('formation_student_questions').select('*').eq('id', threadId).single(),
          supabase.from('formation_question_answers').select('*').eq('question_id', threadId).eq('is_public', true).order('created_at', { ascending: true }),
        ]);
        const question = qRes.data;
        if (!alive || !question) return;
        setThread(question);
        const list = (aRes.data || []).map((a) => ({ ...a, is_solution: a.id === question.accepted_answer_id }));
        setReplies(list);
        setRepliesLoading(false);

        // Round 2 : formation + votes + favori EN PARALLÈLE.
        const [fRes, vRes, favRes] = await Promise.all([
          question.formation_id ? supabase.from('courses').select('title, color').eq('id', question.formation_id).single() : Promise.resolve({ data: null }),
          currentUser ? supabase.from('forum_votes').select('post_id, value').eq('user_id', currentUser.id).in('post_id', [threadId, ...list.map((a) => a.id)]) : Promise.resolve({ data: null }),
          currentUser ? supabase.from('forum_favorites').select('question_id').eq('question_id', threadId).eq('user_id', currentUser.id).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        if (!alive) return;
        if (fRes.data) setFormation(fRes.data);
        if (vRes.data) {
          const voteMap = {};
          vRes.data.forEach((v) => { voteMap[v.post_id] = v.value; });
          setUserVotes(voteMap);
        }
        setIsFav(!!favRes.data);
      } finally {
        if (alive) { setLoading(false); setRepliesLoading(false); }
      }
    };

    load();
    
    // Real-time subscription for new replies
    const channel = supabase
      .channel(`thread-${threadId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'formation_question_answers',
        filter: `question_id=eq.${threadId}`,
      }, (payload) => {
        setReplies(prev => [...prev, payload.new]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'formation_question_answers',
        filter: `question_id=eq.${threadId}`,
      }, (payload) => {
        setReplies(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
      })
      .subscribe();

    return () => { 
      alive = false; 
      supabase.removeChannel(channel);
    };
  }, [threadId, currentUser?.id]);

  // Format date
  const formatDate = (value) => {
    if (!value) return '';
    const d = new Date(value);
    return d.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
  };

  const formatRelative = (value) => {
    if (!value) return '';
    const d = new Date(value);
    const now = new Date();
    const diffMins = Math.floor((now - d) / 60000);
    const diffHours = Math.floor((now - d) / 3600000);
    const diffDays = Math.floor((now - d) / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    return formatDate(value);
  };

  // Submit reply
  const handleReply = async () => {
    if (!replyContent.trim() || !currentUser || !thread) return;

    setReplying(true);
    try {
      const { data: reply, error } = await supabase
        .from('formation_question_answers')
        .insert({
          question_id: threadId,
          student_id: currentUser.id,
          answer: replyContent,
          parent_id: replyTo,
          is_public: true,
        })
        .select()
        .single();

      if (error) throw error;

      setReplies([...replies, reply]);
      setReplyContent('');
      setReplyTo(null);
    } catch (err) {
      alert('Erreur lors de l\'envoi : ' + err.message);
    } finally {
      setReplying(false);
    }
  };

  // Demander une réponse à LIRI Brain (RAG ancré sur la base de connaissances).
  const askLiri = async () => {
    if (!thread || liriLoading) return;
    setLiriLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const slug = localStorage.getItem('cimolace-v2-tenant-slug') || localStorage.getItem('isna-v2-tenant-slug') || localStorage.getItem('tenantSlug') || DEFAULT_TENANT_SLUG;
      const base = (import.meta.env.VITE_API_URL || 'http://localhost:4002').replace(/\/+$/, '');
      const res = await fetch(`${base}/knowledge/answer`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug, 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: thread.question, matchCount: 4 }),
      });
      const j = await res.json();
      const answer = j?.data?.answer;
      const ragSources = Array.isArray(j?.data?.sources) ? j.data.sources : [];
      if (!answer) throw new Error('Réponse indisponible');
      const cited = new Set((answer.match(/\[(\d+)\]/g) || []).map((m) => parseInt(m.replace(/[^\d]/g, ''), 10)));
      let sources = ragSources.filter((s) => cited.has(s.n)).map((s) => ({ type: 'kb', label: s.title }));
      if (!sources.length && ragSources[0]) sources = [{ type: 'kb', label: ragSources[0].title }];
      const { data: inserted, error } = await supabase
        .from('formation_question_answers')
        .insert({ question_id: threadId, student_id: currentUser?.id || null, author_name: 'LIRI Brain', answer, is_ai: true, is_public: true, sources })
        .select()
        .single();
      if (error) throw error;
      setReplies((prev) => [...prev, { ...inserted, is_solution: false }]);
    } catch (e) {
      alert('LIRI : ' + (e?.message || e));
    } finally {
      setLiriLoading(false);
    }
  };

  // Vote
  const handleVote = async (postId, value) => {
    if (!currentUser) {
      alert('Connectez-vous pour voter');
      return;
    }

    const currentVote = userVotes[postId] || 0;
    const newVote = currentVote === value ? 0 : value;

    try {
      if (currentVote !== 0) {
        // Remove existing vote
        await supabase
          .from('forum_votes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUser.id);
      }

      if (newVote !== 0) {
        // Insert new vote
        await supabase
          .from('forum_votes')
          .insert({ post_id: postId, user_id: currentUser.id, value: newVote });
      }

      setUserVotes({ ...userVotes, [postId]: newVote });
    } catch (err) {
      console.error('Vote error:', err);
    }
  };

  // Toggle favorite
  const toggleFav = () => {
    const favs = JSON.parse(localStorage.getItem('forum_favorites') || '[]');
    const newFavs = isFav
      ? favs.filter(id => id !== threadId)
      : [...favs, threadId];
    localStorage.setItem('forum_favorites', JSON.stringify(newFavs));
    setIsFav(!isFav);
  };

  // Mark as solution
  const markAsSolution = async (replyId) => {
    if (!currentUser || currentUser.id !== thread?.student_id) return;

    try {
      // Update the question with accepted_answer_id
      await supabase
        .from('formation_student_questions')
        .update({ 
          accepted_answer_id: replyId,
          status: 'resolved' 
        })
        .eq('id', threadId);

      // Also update the answer
      await supabase
        .from('formation_question_answers')
        .update({ is_solution: true })
        .eq('id', replyId);

      // Update all replies locally
      setReplies(replies.map(r =>
        r.id === replyId ? { ...r, is_solution: true } : { ...r, is_solution: false }
      ));
      
      // Update thread locally
      setThread(prev => prev ? { ...prev, accepted_answer_id: replyId, status: 'resolved' } : null);
    } catch (err) {
      console.error('Error marking solution:', err);
    }
  };

  // Delete reply
  const deleteReply = async (replyId) => {
    if (!confirm('Supprimer cette réponse ?')) return;

    try {
      await supabase
        .from('formation_question_answers')
        .delete()
        .eq('id', replyId);

      setReplies(replies.filter(r => r.id !== replyId));
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
  };

  // Edit reply
  const startEdit = (reply) => {
    setEditingId(reply.id);
    setEditContent(reply.answer);
  };

  const saveEdit = async () => {
    if (!editContent.trim()) return;

    try {
      await supabase
        .from('formation_question_answers')
        .update({ answer: editContent })
        .eq('id', editingId);

      setReplies(replies.map(r =>
        r.id === editingId ? { ...r, answer: editContent } : r
      ));
      setEditingId(null);
      setEditContent('');
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
  };

  // Reply to specific reply (nested)
  const replyToReply = (reply) => {
    setReplyTo(reply.id);
    setReplyContent(`@${reply.student_id?.slice(0, 8)} `);
    replyTextareaRef.current?.focus();
  };

  // Calculate vote count
  const getVoteCount = (postId) => {
    // Simplification: on afficherait normalement le count depuis la DB
    return 0;
  };

  if (loading && !thread) {
    return (
      <div className="forum-dark min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="forum-dark min-h-[60vh] flex flex-col items-center justify-center text-center">
        <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Question introuvable</h2>
        <p className="text-gray-600 mb-4">Cette question n'existe pas ou a été supprimée.</p>
        <Link
          to={forumBase}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Retour au forum
        </Link>
      </div>
    );
  }

  const isAuthor = currentUser?.id === thread.student_id;
  const solutionReply = replies.find(r => r.is_solution);

  // Navigation intelligente dans la conversation (minimap façon Claude).
  const navItems = [
    { key: 'question', type: 'question', author: thread.author_name || 'Anonyme', snippet: thread.question },
    ...replies.map((r) => ({
      key: r.id,
      type: r.is_solution ? 'solution' : (r.is_instructor_answer ? 'instructor' : 'reply'),
      author: r.author_name || (r.student_id === thread.student_id ? 'Auteur' : 'Réponse'),
      snippet: r.answer,
    })),
  ];

  return (
    <div className="forum-dark forum-immersive" style={{ position: 'relative', height: 'calc(100dvh - 150px)', overflow: 'hidden' }}>
      {/* Fond immersif (aurore) */}
      <div aria-hidden style={{ position: 'absolute', inset: '-28px -24px -48px -24px', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #0a0b12 0%, #08090f 58%, #060709 100%)' }}>
          <div style={{ position:'absolute', width:'70vw', height:'70vw', top:'-24%', right:'-14%', borderRadius:'50%', background:'radial-gradient(circle, rgba(212,175,55,0.20), transparent 60%)', filter:'blur(34px)', animation:'forumAurora1 26s ease-in-out infinite' }}/>
          <div style={{ position:'absolute', width:'64vw', height:'64vw', bottom:'-28%', left:'-18%', borderRadius:'50%', background:'radial-gradient(circle, rgba(46,66,112,0.62), transparent 60%)', filter:'blur(34px)', animation:'forumAurora2 33s ease-in-out infinite' }}/>
          <div style={{ position:'absolute', width:'48vw', height:'48vw', top:'34%', left:'44%', borderRadius:'50%', background:'radial-gradient(circle, rgba(212,175,55,0.09), transparent 60%)', filter:'blur(42px)', animation:'forumAurora3 23s ease-in-out infinite' }}/>
          <div style={{ position:'absolute', inset:0, background:'radial-gradient(135% 100% at 50% 22%, transparent 50%, rgba(0,0,0,0.55) 100%)' }}/>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 0, alignItems: 'flex-start', height: '100%' }}>
        <ForumSommaire currentId={threadId} basePath={forumBase} />
        <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.06)', margin: '0 30px', flexShrink: 0 }} />
        <div ref={paneRef} style={{ flex: 1, minWidth: 0, height: '100%', overflowY: 'auto', padding: '0 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* En-tête conversation : retour + titre élégant (sticky) */}
      <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 14, padding: '16px 0 14px', marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'linear-gradient(180deg, #0a0b12 72%, rgba(10,11,18,0))' }}>
        <button
          onClick={() => navigate(forumBase)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 11, background: 'rgba(212,175,55,0.10)', border: '1px solid rgba(212,175,55,0.28)', color: '#D4AF37', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>←</span> Forum
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          {formation && (
            <div style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: 9.5, fontWeight: 600, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
              {formation.title}
            </div>
          )}
          <div style={{ fontSize: 16.5, fontWeight: 700, color: '#F5F5F7', lineHeight: 1.35, letterSpacing: '-0.01em', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {thread.question}
          </div>
        </div>
      </div>

      {/* Question Card */}
      <motion.article
        id="fmsg-question"
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-gray-200 rounded-xl p-6 mb-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">
              {(thread.author_name || 'A').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-gray-900">{thread.author_name || 'Anonyme'}</p>
              <p className="text-sm text-gray-500">{formatRelative(thread.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleFav}
              className={cn(
                'p-2 rounded-lg transition-colors',
                isFav ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:bg-gray-100'
              )}
            >
              <Bookmark className={cn('w-5 h-5', isFav && 'fill-current')} />
            </button>
            <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content (le titre est dans l'en-tête de conversation) */}
        {thread.content && (
          <p className="text-gray-700 leading-relaxed mb-4 whitespace-pre-wrap">
            {thread.content}
          </p>
        )}

        {/* Tags */}
        {thread.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {thread.tags.map(tag => (
              <span
                key={tag}
                className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Video clip */}
        {thread.video_storage_path && (
          <div className="mb-4 rounded-lg overflow-hidden bg-black">
            <video
              controls
              className="w-full max-h-[300px]"
              src={thread.video_url}
            />
          </div>
        )}

        {/* Actions bar */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-4">
            {/* Vote buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleVote(thread.id, 1)}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  userVotes[thread.id] === 1 ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100'
                )}
              >
                <ThumbsUp className="w-5 h-5" />
              </button>
              <span className="font-medium text-gray-700 min-w-[20px] text-center">
                {getVoteCount(thread.id)}
              </span>
              <button
                onClick={() => handleVote(thread.id, -1)}
                className={cn(
                  'p-2 rounded-lg transition-colors rotate-180',
                  userVotes[thread.id] === -1 ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100'
                )}
              >
                <ThumbsUp className="w-5 h-5" />
              </button>
            </div>

            <span className="text-sm text-gray-500">
              {replies.length} réponse{replies.length !== 1 ? 's' : ''}
            </span>
          </div>

          {isAuthor && (
            <button className="text-sm text-gray-500 hover:text-gray-700">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          )}
        </div>
      </motion.article>

      {/* Solution banner */}
      {solutionReply && (
        <motion.div
          initial={false}
          animate={{ opacity: 1 }}
          className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl"
        >
          <div className="flex items-center gap-2 text-green-700 mb-3">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">Solution acceptée</span>
          </div>
          <div className="bg-white rounded-lg p-4">
            <p className="text-gray-700">{solutionReply.answer}</p>
          </div>
        </motion.div>
      )}

      {/* Replies */}
      <div className="space-y-4 mb-8">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Réponses ({replies.length})
          </h3>
          <button
            type="button"
            onClick={askLiri}
            disabled={liriLoading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 15px', borderRadius: 11, background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)', color: '#D4AF37', fontSize: 12.5, fontWeight: 600, cursor: liriLoading ? 'wait' : 'pointer', opacity: liriLoading ? 0.7 : 1 }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>✦</span>{liriLoading ? 'LIRI réfléchit…' : 'Demander à LIRI'}
          </button>
        </div>

        {replies.length === 0 ? (
          repliesLoading ? (
            <div className="text-center py-8 text-gray-500 text-sm">Chargement des réponses…</div>
          ) : (
          <div className="text-center py-8 bg-gray-50 rounded-xl">
            <p className="text-gray-500">Aucune réponse pour l'instant.</p>
            <p className="text-sm text-gray-400">Soyez le premier à répondre !</p>
          </div>
          )
        ) : (
          replies.map((reply, index) => (
            <motion.div
              key={reply.id}
              id={`fmsg-${reply.id}`}
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                'bg-white border rounded-xl p-4',
                reply.is_solution ? 'border-green-300 bg-green-50/50' : 'border-gray-200'
              )}
            >
              {/* Reply header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold" style={{ background: reply.is_ai ? 'linear-gradient(135deg,#D4AF37,#7a5c12)' : 'linear-gradient(135deg,#1e2840,#D4AF37)', flexShrink: 0 }}>
                    {reply.is_ai ? '✦' : (reply.author_name || reply.student_id || 'A').slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {reply.is_ai ? 'LIRI Brain' : (reply.author_name || (reply.student_id === thread.student_id ? 'Auteur' : 'Réponse'))}
                  </span>
                  {(() => {
                    const b = reply.is_ai
                      ? { t: 'IA · à vérifier', c: '#F59E0B', bg: 'rgba(245,158,11,0.14)', bd: 'rgba(245,158,11,0.32)' }
                      : reply.is_instructor_answer
                      ? { t: 'Formateur', c: '#D4AF37', bg: 'rgba(212,175,55,0.14)', bd: 'rgba(212,175,55,0.32)', check: true }
                      : reply.validated_at
                      ? { t: 'Validé formateur', c: '#4ade80', bg: 'rgba(34,197,94,0.14)', bd: 'rgba(34,197,94,0.32)', check: true }
                      : { t: 'Élève', c: 'rgba(245,245,247,0.6)', bg: 'rgba(255,255,255,0.05)', bd: 'rgba(255,255,255,0.12)' };
                    return (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, color: b.c, background: b.bg, border: `1px solid ${b.bd}` }}>
                        {b.check && <CheckCircle2 className="w-3 h-3" />}{b.t}
                      </span>
                    );
                  })()}
                  {reply.is_solution && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, color: '#0b0b0f', background: '#22C55E' }}>
                      <CheckCircle2 className="w-3 h-3" />Solution
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500">{formatRelative(reply.created_at)}</span>
              </div>

              {/* Reply content */}
              {editingId === reply.id ? (
                <div className="space-y-3">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                    >
                      Enregistrer
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setEditContent(''); }}
                      className="px-3 py-1.5 text-gray-600 text-sm hover:text-gray-900"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-gray-700 whitespace-pre-wrap mb-3">{reply.answer}</p>
                  {Array.isArray(reply.sources) && reply.sources.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
                      {reply.sources.map((src, i) => (
                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.22)', color: '#D4AF37' }}>
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                            <path d="M4 2.5h6.5A1.5 1.5 0 0112 4v9.5l-2.75-1.6-2.75 1.6V4A1.5 1.5 0 005 2.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                          </svg>
                          {src.label}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Reply actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleVote(reply.id, 1)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors',
                    userVotes[reply.id] === 1 ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100 text-gray-500'
                  )}
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span>{getVoteCount(reply.id) || 'Utile'}</span>
                </button>

                <button
                  onClick={() => replyToReply(reply)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-sm hover:bg-gray-100 text-gray-500 transition-colors"
                >
                  <CornerDownRight className="w-4 h-4" />
                  Répondre
                </button>

                {isAuthor && !reply.is_solution && (
                  <button
                    onClick={() => markAsSolution(reply.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-sm hover:bg-green-100 text-green-600 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Accepter
                  </button>
                )}

                {currentUser?.id === reply.student_id && (
                  <>
                    <button
                      onClick={() => startEdit(reply)}
                      className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteReply(reply.id)}
                      className="p-1.5 hover:bg-red-100 rounded text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}

                <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 ml-auto">
                  <Flag className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Reply form */}
      {currentUser ? (
        <motion.div
          initial={false}
          animate={{ opacity: 1 }}
          className="bg-gray-50 rounded-xl p-4"
        >
          <h4 className="font-medium text-gray-900 mb-3">
            {replyTo ? 'Répondre à un commentaire' : 'Votre réponse'}
          </h4>
          {replyTo && (
            <div className="flex items-center justify-between mb-2 px-3 py-2 bg-indigo-50 rounded-lg text-sm">
              <span className="text-indigo-700">En réponse à un message</span>
              <button
                onClick={() => setReplyTo(null)}
                className="text-indigo-500 hover:text-indigo-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <textarea
            ref={replyTextareaRef}
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Écrivez votre réponse..."
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[120px] resize-y bg-white"
            rows={4}
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-gray-500">
              Soyez respectueux et constructif
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleReply}
              disabled={!replyContent.trim() || replying}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#0a0a0f] text-white rounded-lg font-medium hover:bg-[#5b3df5] disabled:opacity-50 transition-colors"
            >
              {replying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Répondre
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      ) : (
        <div className="text-center py-6 bg-gray-50 rounded-xl">
          <p className="text-gray-600">Connectez-vous pour répondre</p>
        </div>
      )}
        </div>
        </div>
        <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.06)', margin: '0 30px', flexShrink: 0 }} />
        <ForumConvNav items={navItems} />
      </div>
    </div>
  );
}
