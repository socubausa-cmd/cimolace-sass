import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 640px)';

function subscribe(onStoreChange) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

/** true sur viewport étroit (sm) — drawer forum / panneau membres en feuille basse. */
export function usePreferNarrowLiveViewport() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
