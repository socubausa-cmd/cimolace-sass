import React from 'react';

/**
 * Capture les erreurs React non catchées — affiche un écran de repli au lieu
 * d'un écran noir total (qui survient quand React démontre tout l'arbre).
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    const tag = this.props.logTag ? ` [${this.props.logTag}]` : '';
    // Chunk périmé après déploiement (import dynamique d'une page lazy supprimée)
    // → recharge une fois plutôt que d'afficher l'écran d'erreur.
    const msg = String(error?.message || '');
    const isChunkError = /dynamically imported module|Importing a module script failed|ChunkLoadError|error loading dynamically imported|Failed to fetch dynamically/i.test(msg);
    if (isChunkError && typeof window !== 'undefined' && window.__reloadOnceForChunk?.()) {
      return; // rechargement en cours
    }
    console.error(`[ErrorBoundary]${tag}`, error, info?.componentStack || '');
  }

  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error);
      }
      const err = this.state.error;
      const showStack =
        typeof import.meta !== 'undefined' &&
        import.meta.env?.DEV &&
        this.props.showDetailsInDev &&
        err?.stack;
      return (
        <div
          style={{
            height: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0F1117',
            color: '#fff',
            gap: '16px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          {this.props.logTag ? (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.35)' }}>{this.props.logTag}</div>
          ) : null}
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>
            Une erreur inattendue s'est produite
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,.5)', maxWidth: '400px' }}>
            {String(err?.message || 'Erreur inconnue')}
          </div>
          {showStack ? (
            <pre
              style={{
                maxWidth: '100%',
                maxHeight: '40vh',
                overflow: 'auto',
                textAlign: 'left',
                fontSize: '10px',
                color: 'rgba(255,200,200,.75)',
                background: 'rgba(0,0,0,.35)',
                padding: '10px',
                borderRadius: '8px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {err.stack}
            </pre>
          ) : null}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: '8px',
              padding: '10px 24px',
              borderRadius: '10px',
              border: '1px solid rgba(200,150,12,.4)',
              background: 'rgba(200,150,12,.12)',
              color: '#e5c47a',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Recharger la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
