import { useCallback, useEffect, useRef, useState } from 'react';

export const LIVE_STUDIO_DRAFT_STORAGE_KEY = 'live_studio_draft';
const STORAGE_KEY = LIVE_STUDIO_DRAFT_STORAGE_KEY;
const AUTOSAVE_DEBOUNCE_MS = 1500;

export const DEFAULT_DRAFT = {
  // Étape 1
  title: '',
  description: '',
  session_type: 'classe',
  category: 'formation',
  // Étape 2
  cover_image_url: '',
  thumbnail_url: '',
  // Étape 3
  scheduled_at: '',
  scheduled_time: '14:00',
  duration_minutes: 60,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris',
  recurrence: 'none',
  // Étape 4
  is_public: true,
  invite_only: false,
  password: '',
  visibility_mode: 'secret',
  waiting_room: true,
  waiting_room_audio_enabled: false,
  waiting_room_show_plan: false,
  waiting_room_show_details: true,
  waiting_room_welcome_message: '',
  manual_approval: false,
  access_mode: 'free',    // free | password | manual | double
  notify_dashboard: true,
  notify_email: false,
  notify_whatsapp: false,
  reminder_before_minutes: 15,
  // Étape 5
  invited_users: [],
  invited_classes: [],    // [{ id, name }]
  invited_modules: [],    // [{ id, name }]
  invited_roles: [],      // ['teacher','student','ngowazulu_member',...]
  moderators: [],
  allow_members_invite: false,
  // Étape 6
  chat_enabled: true,
  hand_raise_enabled: true,
  screen_share_enabled: true,
  student_audio_enabled: true,
  student_video_enabled: false,
  recording_enabled: false,
  // Étape 6 — Scènes SmartBoard
  smartboard_scenes: {
    smartboard: true,
    diapo: true,
    screen: true,
    browser: true,
    embed: true,
    quiz: true,
    board: true,
    image: true,
    camera2: false,
    shop: true,
  },
  smartboard_slides: [],
  smartboard_shared_images: [],
  /** Défilement automatique de la galerie « Images partagées » sur l’écran intelligent */
  smartboard_shared_images_loop: false,
  /** Scènes type live_scenes (éléments SmartBoard) — injectées au live si pas de live_scenes en base */
  smartboard_element_scenes: [],
  /** Sections de script maître (aperçu hôte) — optionnel */
  smartboard_master_script_sections: [],
  smartboard_default_browser_url: '',
  smartboard_shop_products: [],
  // Étape 7
  quiz_enabled: false,
  polls_enabled: false,
  ai_summary_enabled: false,
  ai_mindmap_enabled: false,
  neuronq_enabled: false,
  neuro_recall_enabled: false,
  ambient_audio_enabled: false,
  ambient_tracks: [],
  /** Moteur LIRI (Arena) — playlist dans live_sessions.config */
  liri_audio_enabled: false,
  liri_audio_scenes: [],
  // Meta
  lastSavedAt: null,
};

export function useLiveStudioDraft(userId, teacherId) {
  const initialRef = useRef(null);
  if (!initialRef.current) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        initialRef.current = { draft: { ...DEFAULT_DRAFT }, savedAt: null };
      } else {
        const parsed = JSON.parse(raw);
        if (parsed.userId !== userId) {
          initialRef.current = { draft: { ...DEFAULT_DRAFT }, savedAt: null };
        } else {
          initialRef.current = {
            draft: { ...DEFAULT_DRAFT, ...parsed.data },
            savedAt: parsed.savedAt ? new Date(parsed.savedAt).getTime() : null,
          };
        }
      }
    } catch {
      initialRef.current = { draft: { ...DEFAULT_DRAFT }, savedAt: null };
    }
  }

  const [draft, setDraft] = useState(initialRef.current.draft);
  const [lastSavedAt, setLastSavedAt] = useState(initialRef.current.savedAt);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState(null);
  const debounceRef = useRef(null);
  const latestDraftRef = useRef(initialRef.current.draft);
  const skipFlushRef = useRef(false);

  const saveToStorage = useCallback((data) => {
    try {
      const payload = { userId, teacherId, data, savedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setSaveStatus('saved');
      setSaveError(null);
      setLastSavedAt(Date.now());
    } catch (e) {
      setSaveStatus('error');
      setSaveError('Sauvegarde locale impossible');
      console.warn('[LiveStudio] autosave failed', e);
    }
  }, [userId, teacherId]);

  const flushSave = useCallback(() => {
    if (skipFlushRef.current) return;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    saveToStorage(latestDraftRef.current);
  }, [saveToStorage]);

  const updateDraft = useCallback((updates) => {
    setDraft((prev) => {
      const next = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates };
      skipFlushRef.current = false;
      latestDraftRef.current = next;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSaveStatus('saving');
      setSaveError(null);
      debounceRef.current = setTimeout(() => saveToStorage(next), AUTOSAVE_DEBOUNCE_MS);
      return next;
    });
  }, [saveToStorage]);

  const clearDraft = useCallback(() => {
    skipFlushRef.current = true;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    localStorage.removeItem(STORAGE_KEY);
    const cleared = { ...DEFAULT_DRAFT };
    latestDraftRef.current = cleared;
    setDraft(cleared);
    setLastSavedAt(null);
    setSaveStatus('idle');
    setSaveError(null);
  }, []);

  useEffect(() => {
    latestDraftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      flushSave();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flushSave();
    };
  }, [flushSave]);

  return { draft, updateDraft, clearDraft, lastSavedAt, saveStatus, saveError };
}
