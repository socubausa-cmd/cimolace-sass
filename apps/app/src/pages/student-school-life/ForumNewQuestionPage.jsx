import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Send,
  Loader2,
  Video,
  X,
  Tag,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';

/**
 * Page création de nouvelle question forum
 * Features:
 * - Titre + contenu éditeur
 * - Sélection formation
 * - Upload vidéo clip (optionnel)
 * - Tags (autocomplete)
 * - Preview avant publication
 */
export default function ForumNewQuestionPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formations, setFormations] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedFormation, setSelectedFormation] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  // Video clip state
  const [videoFile, setVideoFile] = useState(null);
  const [clipStart, setClipStart] = useState('');
  const [clipEnd, setClipEnd] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  // Error/Success state
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Load user + formations
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (!user) return;

      // Load formations where user is enrolled
      const { data: enrollments } = await supabase
        .from('formation_enrollments')
        .select('formation_id')
        .eq('student_id', user.id)
        .eq('status', 'active');

      const formationIds = enrollments?.map(e => e.formation_id) || [];

      if (formationIds.length > 0) {
        const { data: forms } = await supabase
          .from('courses')
          .select('id, title, color')
          .in('id', formationIds);
        setFormations(forms || []);
        if (forms?.[0]) setSelectedFormation(forms[0].id);
      }
    };
    load();
  }, []);

  // Suggested tags
  const suggestedTags = [
    'mécanique', 'électricité', 'chimie', 'physique', 'math',
    'programmation', 'design', 'marketing', 'gestion', 'comptabilité',
    'examen', 'concours', 'projet', 'stage', 'mémoire',
    'aide', 'urgent', 'question', 'clarification', 'astuce'
  ];

  const addTag = (tag) => {
    if (!tag || tags.includes(tag) || tags.length >= 5) return;
    setTags([...tags, tag]);
    setTagInput('');
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
    }
  };

  const clearVideo = () => {
    setVideoFile(null);
    setClipStart('');
    setClipEnd('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validate = () => {
    if (!title.trim() || title.length < 10) {
      return 'Le titre doit contenir au moins 10 caractères';
    }
    if (!content.trim() || content.length < 20) {
      return 'Le contenu doit contenir au moins 20 caractères';
    }
    if (!selectedFormation) {
      return 'Veuillez sélectionner une formation';
    }
    if (videoFile && (clipStart || clipEnd)) {
      const start = parseFloat(clipStart);
      const end = parseFloat(clipEnd);
      if (isNaN(start) || isNaN(end) || start >= end) {
        return 'Les timestamps du clip sont invalides';
      }
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      let videoStoragePath = null;

      // Upload video if present
      if (videoFile) {
        const fileExt = videoFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `forum_clips/${currentUser.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('videos')
          .upload(filePath, videoFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;
        videoStoragePath = filePath;
      }

      // Create question
      const { data: question, error: insertError } = await supabase
        .from('formation_student_questions')
        .insert({
          formation_id: selectedFormation,
          student_id: currentUser.id,
          question: title,
          content: content,
          tags: tags,
          is_public: isPublic,
          video_storage_path: videoStoragePath,
          clip_start_seconds: clipStart ? parseFloat(clipStart) : null,
          clip_end_seconds: clipEnd ? parseFloat(clipEnd) : null,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      setSuccess(true);
      setTimeout(() => {
        navigate(`/student-school-life/forum/thread/${question.id}`);
      }, 1500);

    } catch (err) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Question publiée !</h2>
          <p className="text-gray-600">Redirection vers votre question...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/student-school-life/forum')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle question</h1>
          <p className="text-sm text-gray-600">Posez votre question à la communauté</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Formation */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Formation concernée
          </label>
          <select
            value={selectedFormation}
            onChange={(e) => setSelectedFormation(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          >
            <option value="">Choisir une formation</option>
            {formations.map((f) => (
              <option key={f.id} value={f.id}>{f.title}</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Titre de votre question
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Comment résoudre une équation du second degré ?"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
            minLength={10}
            maxLength={200}
          />
          <p className="mt-1 text-xs text-gray-500">
            {title.length}/200 caractères minimum 10
          </p>
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Détaillez votre question
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Expliquez votre problème en détail..."
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[150px] resize-y"
            required
            minLength={20}
            maxLength={2000}
          />
          <p className="mt-1 text-xs text-gray-500">
            {content.length}/2000 caractères minimum 20
          </p>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags ({tags.length}/5)
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:bg-indigo-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag(tagInput.trim().toLowerCase());
                }
              }}
              placeholder="Ajouter un tag..."
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={tags.length >= 5}
            />
            <button
              type="button"
              onClick={() => addTag(tagInput.trim().toLowerCase())}
              disabled={tags.length >= 5 || !tagInput.trim()}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg transition-colors"
            >
              <Tag className="w-4 h-4" />
            </button>
          </div>
          {/* Suggested tags */}
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestedTags
              .filter(t => !tags.includes(t))
              .slice(0, 8)
              .map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  className="px-2 py-1 text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-full transition-colors"
                >
                  + {tag}
                </button>
              ))}
          </div>
        </div>

        {/* Video Clip */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Video className="w-5 h-5 text-gray-500" />
            <span className="font-medium text-gray-700">Clip vidéo (optionnel)</span>
          </div>

          {!videoFile ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-center"
              >
                <Video className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Cliquez pour ajouter une vidéo</p>
                <p className="text-xs text-gray-500 mt-1">MP4, WebM, MOV - Max 50MB</p>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700 truncate">{videoFile.name}</span>
                <button
                  type="button"
                  onClick={clearVideo}
                  className="p-1 hover:bg-gray-200 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-600">Début clip (sec)</label>
                  <input
                    type="number"
                    value={clipStart}
                    onChange={(e) => setClipStart(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-600">Fin clip (sec)</label>
                  <input
                    type="number"
                    value={clipEnd}
                    onChange={(e) => setClipEnd(e.target.value)}
                    placeholder="10"
                    min="1"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Visibility */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isPublic"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="isPublic" className="text-sm text-gray-700">
            Rendre cette question publique (visible par toute la communauté)
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <button
            type="button"
            onClick={() => navigate('/student-school-life/forum')}
            className="px-6 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            Annuler
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-8 py-3 bg-[#0a0a0f] text-white rounded-lg font-medium hover:bg-[#5b3df5] disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Publication...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Publier la question
              </>
            )}
          </motion.button>
        </div>
      </form>
    </div>
  );
}
