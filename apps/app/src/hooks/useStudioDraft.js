/**
 * Hook générique d'autosave pour les studios
 * Réutilisable pour formation, appointment, event, coaching
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const AUTOSAVE_DEBOUNCE_MS = 1500;

export function useStudioDraft(storageKey, defaultDraft, userId) {
  const initialRef = useRef(null);
  if (!initialRef.current) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        initialRef.current = { draft: { ...defaultDraft }, savedAt: null };
      } else {
        const parsed = JSON.parse(raw);
        if (parsed.userId !== userId) {
          initialRef.current = { draft: { ...defaultDraft }, savedAt: null };
        } else {
          initialRef.current = {
            draft: { ...defaultDraft, ...parsed.data },
            savedAt: parsed.savedAt ? new Date(parsed.savedAt).getTime() : null,
          };
        }
      }
    } catch {
      initialRef.current = { draft: { ...defaultDraft }, savedAt: null };
    }
  }

  const [lastSavedAt, setLastSavedAt] = useState(initialRef.current.savedAt);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState(null);
  const debounceRef = useRef(null);
  const latestDraftRef = useRef(initialRef.current.draft);
  const skipFlushRef = useRef(false);
  const [draft, setDraft] = useState(initialRef.current.draft);

  const saveToStorage = useCallback(
    (data) => {
      try {
        const payload = { userId, data, savedAt: new Date().toISOString() };
        localStorage.setItem(storageKey, JSON.stringify(payload));
        setSaveStatus('saved');
        setSaveError(null);
        setLastSavedAt(Date.now());
      } catch (e) {
        setSaveStatus('error');
        setSaveError('Sauvegarde locale impossible');
        console.warn(`[Studio ${storageKey}] autosave failed`, e);
      }
    },
    [storageKey, userId]
  );

  const flushSave = useCallback(() => {
    if (skipFlushRef.current) return;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    saveToStorage(latestDraftRef.current);
  }, [saveToStorage]);

  const updateDraft = useCallback(
    (updates) => {
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
    },
    [saveToStorage]
  );

  const clearDraft = useCallback(() => {
    skipFlushRef.current = true;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    localStorage.removeItem(storageKey);
    const cleared = { ...defaultDraft };
    latestDraftRef.current = cleared;
    setDraft(cleared);
    setLastSavedAt(null);
    setSaveStatus('idle');
    setSaveError(null);
  }, [storageKey, defaultDraft]);

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
