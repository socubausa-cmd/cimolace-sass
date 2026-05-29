/**
 * ═══════════════════════════════════════════════════════════════
 * LIRI Live Widget — v1.0.0
 * Intégrez un live LIRI dans n'importe quel site web.
 *
 * UTILISATION — méthode 1 : balise data-* (recommandée)
 * ──────────────────────────────────────────────────────
 *   <div
 *     class="liri-live"
 *     data-tenant="ecole-fatima"
 *     data-session="abc123"
 *     data-height="600"
 *   ></div>
 *   <script src="https://app.prorascience.org/liri-widget.js" async></script>
 *
 * UTILISATION — méthode 2 : API JS
 * ─────────────────────────────────
 *   <div id="mon-live"></div>
 *   <script src="https://app.prorascience.org/liri-widget.js"></script>
 *   <script>
 *     LiriWidget.mount({
 *       container: '#mon-live',
 *       tenant: 'ecole-fatima',
 *       session: 'abc123',
 *       height: 600,
 *       theme: 'dark',          // 'dark' | 'light'
 *       apiBase: 'https://api.prorascience.org',  // optionnel
 *       appBase: 'https://app.prorascience.org',  // optionnel
 *       onJoined: (info) => console.log('Rejoint:', info),
 *       onEnded: () => console.log('Session terminée'),
 *       onError: (msg) => console.error('Erreur:', msg),
 *     });
 *   </script>
 *
 * PRÉREQUIS
 * ─────────
 * - Votre domaine doit être ajouté dans les paramètres embed de votre école
 *   (Tableau de bord → Paramètres → Domaines autorisés)
 * - LIRI_EMBED_JWT_SECRET doit être configuré côté serveur
 * ═══════════════════════════════════════════════════════════════
 */
(function (global) {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────
  var VERSION = '1.0.0';
  var DEFAULT_API_BASE = 'https://api.prorascience.org';
  var DEFAULT_APP_BASE = 'https://app.prorascience.org';
  var DEFAULT_HEIGHT = 560;
  var WIDGET_ATTR = 'data-liri-widget';

  // ── Helpers ────────────────────────────────────────────────────────────────

  function resolveBase(scriptSrc) {
    // Inférer le app/api base depuis l'URL du script
    // https://app.prorascience.org/liri-widget.js → https://app.prorascience.org
    try {
      var url = new URL(scriptSrc);
      var appBase = url.origin;
      // Remplace "app." par "api." pour l'API base
      var apiBase = appBase.replace(/^(https?:\/\/)app\./, '$1api.');
      return { appBase: appBase, apiBase: apiBase };
    } catch (e) {
      return { appBase: DEFAULT_APP_BASE, apiBase: DEFAULT_API_BASE };
    }
  }

  function currentScriptBases() {
    var scripts = document.querySelectorAll('script[src*="liri-widget"]');
    var src = scripts.length > 0 ? scripts[scripts.length - 1].src : '';
    return resolveBase(src);
  }

  function normalizeContainer(containerSelector) {
    if (!containerSelector) return null;
    if (typeof containerSelector === 'string') {
      return document.querySelector(containerSelector);
    }
    return containerSelector;
  }

  function createIframe(src, height, theme) {
    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.style.cssText = [
      'width:100%',
      'height:' + (parseInt(height, 10) || DEFAULT_HEIGHT) + 'px',
      'border:none',
      'border-radius:12px',
      'background:' + (theme === 'light' ? '#ffffff' : '#0d1117'),
      'display:block',
      'overflow:hidden',
    ].join(';');
    iframe.setAttribute('allow', 'camera; microphone; autoplay; fullscreen; display-capture');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('title', 'LIRI Live');
    return iframe;
  }

  function createPlaceholder(height, theme) {
    var wrap = document.createElement('div');
    wrap.style.cssText = [
      'width:100%',
      'height:' + (parseInt(height, 10) || DEFAULT_HEIGHT) + 'px',
      'border-radius:12px',
      'background:' + (theme === 'light' ? '#f9fafb' : '#0d1117'),
      'border:1px solid ' + (theme === 'light' ? '#e5e7eb' : '#21262d'),
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'flex-direction:column',
      'gap:12px',
      'font-family:system-ui,sans-serif',
    ].join(';');

    var spinner = document.createElement('div');
    spinner.style.cssText = [
      'width:32px',
      'height:32px',
      'border:3px solid ' + (theme === 'light' ? '#e5e7eb' : '#21262d'),
      'border-top:3px solid #7c3aed',
      'border-radius:50%',
      'animation:liri-spin 0.8s linear infinite',
    ].join(';');

    var label = document.createElement('p');
    label.textContent = 'Chargement du live…';
    label.style.cssText = [
      'color:' + (theme === 'light' ? '#6b7280' : '#8b949e'),
      'font-size:13px',
      'margin:0',
    ].join(';');

    var style = document.createElement('style');
    style.textContent = '@keyframes liri-spin{to{transform:rotate(360deg)}}';

    wrap.appendChild(style);
    wrap.appendChild(spinner);
    wrap.appendChild(label);
    return { wrap: wrap, label: label };
  }

  // ── Core mount function ────────────────────────────────────────────────────

  function mount(options) {
    if (!options || !options.tenant || !options.session) {
      console.error('[LIRI Widget] options.tenant et options.session sont requis');
      return { unmount: function () {} };
    }

    var bases = currentScriptBases();
    var apiBase = options.apiBase || bases.apiBase;
    var appBase = options.appBase || bases.appBase;
    var height = options.height || DEFAULT_HEIGHT;
    var theme = options.theme || 'dark';

    var container = normalizeContainer(options.container);
    if (!container) {
      console.error('[LIRI Widget] container introuvable :', options.container);
      return { unmount: function () {} };
    }

    // Éviter le double-montage
    if (container.getAttribute(WIDGET_ATTR)) {
      return { unmount: function () {} };
    }
    container.setAttribute(WIDGET_ATTR, '1');

    // Afficher le placeholder pendant le chargement
    var ph = createPlaceholder(height, theme);
    container.appendChild(ph.wrap);

    var iframe = null;
    var destroyed = false;

    // Listener postMessage pour les événements de l'iframe
    function onMessage(event) {
      if (event.origin !== appBase && appBase !== 'http://localhost:5173') return;
      var data = event.data;
      if (!data || typeof data !== 'object') return;

      switch (data.type) {
        case 'LIRI_SESSION_JOINED':
          if (typeof options.onJoined === 'function') {
            options.onJoined({ sessionId: data.sessionId, room: data.room });
          }
          break;
        case 'LIRI_SESSION_ENDED':
          if (typeof options.onEnded === 'function') options.onEnded();
          break;
        case 'LIRI_ERROR':
          if (typeof options.onError === 'function') options.onError(data.message);
          break;
        default:
          break;
      }
    }
    window.addEventListener('message', onMessage);

    // Obtenir le token embed depuis l'API
    fetch(apiBase + '/lives/embed/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant: options.tenant,
        session: options.session,
        role: options.role || 'viewer',
      }),
    })
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (body) {
            throw new Error(body.message || 'Erreur ' + res.status);
          });
        }
        return res.json();
      })
      .then(function (result) {
        if (destroyed) return;
        var data = result.data || result;
        var iframeSrc = data.iframe_url;

        if (!iframeSrc) {
          throw new Error('iframe_url manquant dans la réponse');
        }

        // Remplacer le placeholder par l'iframe
        iframe = createIframe(iframeSrc, height, theme);
        container.replaceChild(iframe, ph.wrap);
      })
      .catch(function (err) {
        if (destroyed) return;
        console.error('[LIRI Widget] Erreur :', err.message);

        // Afficher un état d'erreur dans le placeholder
        ph.label.textContent = 'Impossible de charger le live';
        ph.label.style.color = '#f87171';
        var spinner = ph.wrap.querySelector('[style*="animation"]');
        if (spinner) spinner.style.display = 'none';

        if (typeof options.onError === 'function') options.onError(err.message);
      });

    return {
      unmount: function () {
        destroyed = true;
        window.removeEventListener('message', onMessage);
        container.removeAttribute(WIDGET_ATTR);
        if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
        if (ph.wrap.parentNode) ph.wrap.parentNode.removeChild(ph.wrap);
      },
    };
  }

  // ── Auto-mount : scan des éléments .liri-live ──────────────────────────────

  function autoMount() {
    var elements = document.querySelectorAll('.liri-live:not([' + WIDGET_ATTR + '])');
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var tenant = el.getAttribute('data-tenant');
      var session = el.getAttribute('data-session');
      if (!tenant || !session) continue;

      mount({
        container: el,
        tenant: tenant,
        session: session,
        height: el.getAttribute('data-height') || DEFAULT_HEIGHT,
        theme: el.getAttribute('data-theme') || 'dark',
        role: el.getAttribute('data-role') || 'viewer',
        apiBase: el.getAttribute('data-api-base') || undefined,
        appBase: el.getAttribute('data-app-base') || undefined,
      });
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  var LiriWidget = {
    version: VERSION,
    mount: mount,
    autoMount: autoMount,
  };

  // Exposition globale
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LiriWidget;
  } else {
    global.LiriWidget = LiriWidget;
  }

  // Auto-mount au chargement du DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    // DOM déjà prêt (script chargé en async/defer ou bas de page)
    autoMount();
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
