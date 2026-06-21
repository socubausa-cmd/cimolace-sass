/**
 * Style du conteneur racine session live (hôte / invité).
 */
export function getLiveHostSessionRootStyle({ liveShell, lhLayoutCompact }) {
  return {
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    gap: `${liveShell.gap}px`,
    backgroundColor: liveShell.pageBg,
    backgroundImage: liveShell.pageMesh,
    overflow: 'hidden',
    fontFamily: 'system-ui,-apple-system,sans-serif',
    color: '#fff',
    boxSizing: 'border-box',
    padding: lhLayoutCompact
      ? 'max(10px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px))'
      : '14px',
  };
}
