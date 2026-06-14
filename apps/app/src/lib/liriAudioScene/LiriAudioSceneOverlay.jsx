import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sceneBus } from './scene-bus';

const AUTO_HIDE_MS = 14000;

/** @param {import('./scene-types').SmartboardPayload | undefined} p */
function hasVisualPayload(p) {
  if (!p) return false;
  const c = p.content != null && String(p.content).trim().length > 0;
  const u = p.url != null && String(p.url).trim().length > 0;
  return c || u;
}

/**
 * Affiche le contenu `smartboardPayload` des scènes (texte, prière, image) au-dessus de la zone centrale.
 * Complète `useLiriAudioSmartboardSync` pour un rendu par défaut sans câblage parent.
 *
 * - Hôte : `remotePayload` omis → événements `sceneBus` (scene:changed).
 * - Invité : passer `remotePayload` (+ optionnel `remoteSceneName`) depuis le broadcast SmartBoard hôte.
 *
 * @param {{
 *   className?: string;
 *   enabled?: boolean;
 *   remotePayload?: import('./scene-types').SmartboardPayload | null;
 *   remoteSceneName?: string | null;
 * }} props
 */
export function LiriAudioSceneOverlay({
  className,
  enabled = true,
  remotePayload,
  remoteSceneName,
}) {
  const remoteMode = remotePayload !== undefined;
  const [visible, setVisible] = useState(false);
  const [sceneName, setSceneName] = useState('');
  /** @type {[{ type: string; content?: string; url?: string } | null, function]} */
  const [payload, setPayload] = useState(null);
  const hideTimer = useRef(null);

  const clearTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setVisible(false);
    setPayload(null);
  }, [clearTimer]);

  useEffect(() => {
    if (!enabled || remoteMode) return undefined;
    return sceneBus.subscribe((ev) => {
      if (ev.type !== 'scene:changed') return;
      if (!hasVisualPayload(ev.payload)) return;
      clearTimer();
      setSceneName(ev.sceneName ?? '');
      setPayload(ev.payload ?? null);
      setVisible(true);
      hideTimer.current = setTimeout(() => {
        setVisible(false);
        hideTimer.current = null;
      }, AUTO_HIDE_MS);
    });
  }, [enabled, remoteMode, clearTimer]);

  useEffect(() => {
    if (!enabled || !remoteMode) return undefined;
    clearTimer();
    if (!hasVisualPayload(remotePayload)) {
      setVisible(false);
      setPayload(null);
      setSceneName('');
      return undefined;
    }
    setSceneName(remoteSceneName ?? '');
    setPayload(remotePayload);
    setVisible(true);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      hideTimer.current = null;
    }, AUTO_HIDE_MS);
    return () => clearTimer();
  }, [enabled, remoteMode, remotePayload, remoteSceneName, clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  if (!enabled || !visible || !payload) return null;

  const { type, content, url } = payload;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-auto absolute left-1/2 top-[min(18vh,140px)] z-[44] w-[min(92vw,520px)] -translate-x-1/2 rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[#070a10]/92 p-4 text-white shadow-[0_28px_80px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl',
        className,
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[color-mix(in_srgb,var(--school-accent)_85%,transparent)]">
            Scène — SmartBoard
          </div>
          {sceneName ? (
            <div className="truncate text-sm font-medium text-[#f5dd8a]">{sceneName}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {type === 'image' && url ? (
        <img src={url} alt="" className="max-h-[min(36vh,280px)] w-full rounded-xl object-contain" />
      ) : null}

      {(type === 'text' || type === 'prayer' || type === 'slide' || type === 'custom') && content ? (
        <p
          className={cn(
            'whitespace-pre-wrap text-sm leading-relaxed text-white/90',
            type === 'prayer' && 'font-serif text-[#f5dd8a]/95',
          )}
        >
          {content}
        </p>
      ) : null}

      {(type === 'video' || type === 'slide') && url && type !== 'image' ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-[var(--school-accent)] underline-offset-2 hover:underline"
        >
          Ouvrir le média
        </a>
      ) : null}
    </div>
  );
}
