import { useEffect } from 'react';

/** Titre navigateur : libellé LIRI live + titre de session optionnel. */
export function useLiveHostDocumentTitle(liriLiveUiLabel, sessionTitle) {
  useEffect(() => {
    const prevTitle = document.title;
    const suffix = sessionTitle?.trim() ? ` · ${sessionTitle.trim()}` : '';
    document.title = `${liriLiveUiLabel}${suffix}`;
    return () => {
      document.title = prevTitle;
    };
  }, [liriLiveUiLabel, sessionTitle]);
}
