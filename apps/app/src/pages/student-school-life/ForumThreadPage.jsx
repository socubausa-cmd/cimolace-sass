import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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

  // Data states
  const [thread, setThread] = useState(null);
  const [replies, setReplies] = useState([]);
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
      setLoading(true);
      try {
        // Load question with accepted answer
        const { data: question } = await supabase
          .from('formation_student_questions')
          .select('*, accepted_answer:accepted_answer_id(*)')
          .eq('id', threadId)
          .single();

        if (!alive || !question) return;
        setThread(question);

        // Load formation
        if (question.formation_id) {
          const { data: form } = await supabase
            .from('courses')
            .select('title, color')
            .eq('id', question.formation_id)
            .single();
          if (alive) setFormation(form);
        }

        // Load replies
        const { data: answers } = await supabase
          .from('formation_question_answers')
          .select('*')
          .eq('question_id', threadId)
          .eq('is_public', true)
          .order('created_at', { ascending: true });

        if (alive) {
          // Mark accepted answer
          const processed = (answers || []).map(a => ({
            ...a,
            is_solution: a.id === question.accepted_answer_id
          }));
          setReplies(processed);
        }

        // Load user votes
        if (currentUser) {
          const { data: votes } = await supabase
            .from('forum_votes')
            .select('post_id, value')
            .eq('user_id', currentUser.id)
            .in('post_id', [threadId, ...(answers || []).map(a => a.id)]);

          if (alive && votes) {
            const voteMap = {};
            votes.forEach(v => voteMap[v.post_id] = v.value);
            setUserVotes(voteMap);
          }
        }

        // Check favorite from DB
        if (currentUser) {
          const { data: fav } = await supabase
            .from('forum_favorites')
            .select('question_id')
            .eq('question_id', threadId)
            .eq('user_id', currentUser.id)
            .single();
          setIsFav(!!fav);
        }

      } finally {
        if (alive) setLoading(false);
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

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
        <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Question introuvable</h2>
        <p className="text-gray-600 mb-4">Cette question n'existe pas ou a été supprimée.</p>
        <Link
          to="/student-school-life/forum"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Retour au forum
        </Link>
      </div>
    );
  }

  const isAuthor = currentUser?.id === thread.student_id;
  const solutionReply = replies.find(r => r.is_solution);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to="/student-school-life/forum" className="hover:text-gray-900">
          Forum
        </Link>
        <span>/</span>
        {formation && (
          <>
            <span className="text-indigo-600">{formation.title}</span>
            <span>/</span>
          </>
        )}
        <span className="text-gray-900 truncate max-w-[200px]">{thread.question}</span>
      </div>

      {/* Question Card */}
      <motion.article
        initial={{ opacity: 0, y: 20 }}
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

        {/* Title & Content */}
        <h1 className="text-xl font-bold text-gray-900 mb-3">{thread.question}</h1>
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
          initial={{ opacity: 0 }}
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
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Réponses ({replies.length})
        </h3>

        {replies.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-xl">
            <p className="text-gray-500">Aucune réponse pour l'instant.</p>
            <p className="text-sm text-gray-400">Soyez le premier à répondre !</p>
          </div>
        ) : (
          replies.map((reply, index) => (
            <motion.div
              key={reply.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                'bg-white border rounded-xl p-4',
                reply.is_solution ? 'border-green-300 bg-green-50/50' : 'border-gray-200'
              )}
            >
              {/* Reply header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-sm font-medium">
                    {(reply.student_id || 'A').slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {reply.student_id === thread.student_id ? 'Auteur' : 'Réponse'}
                  </span>
                  {reply.is_instructor_answer && (
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                      Instructeur
                    </span>
                  )}
                  {reply.is_solution && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Solution
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
                <p className="text-gray-700 whitespace-pre-wrap mb-3">{reply.answer}</p>
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
          initial={{ opacity: 0 }}
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
  );
}
