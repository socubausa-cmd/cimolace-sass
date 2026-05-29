/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LIRI SDK — v2.0.0
 * SDK universel pour intégrer LIRI Live dans n'importe quel site web.
 * Concurrent Zoom : viewer, hôte, co-hôte, studio, gestion de sessions.
 *
 * ── Utilisation rapide (viewer) ────────────────────────────────────────────
 *   <div id="live"></div>
 *   <script src="https://app.prorascience.org/liri-sdk.js"></script>
 *   <script>
 *     const liri = LiriSDK.init({ tenant: 'isna' });
 *     liri.viewer('#live', { session: 'SESSION_ID' });
 *   </script>
 *
 * ── Utilisation avancée (hôte avec API key) ────────────────────────────────
 *   const liri = LiriSDK.init({
 *     tenant: 'isna',
 *     apiKey: 'lk_live_xxxx',           // Depuis dashboard LIRI
 *   });
 *
 *   // Créer une session
 *   const { data: session } = await liri.createSession({
 *     title: 'Mon webinar',
 *     type: 'webinar',
 *     scheduled_at: '2026-06-01T14:00:00Z',
 *   });
 *
 *   // Embarquer l'interface hôte complète (Zoom-like)
 *   liri.host('#container', { session: session.id });
 *
 *   // Écouter les événements
 *   liri.on('session:started', (info) => console.log('Live started!', info));
 *   liri.on('participant:joined', (info) => console.log('New participant:', info));
 *
 * ── Auto-mount (méthode data-*) ────────────────────────────────────────────
 *   <div class="liri-live"
 *     data-tenant="isna"
 *     data-session="SESSION_ID"
 *     data-role="viewer"          <!-- viewer | host | co_host -->
 *     data-height="560"
 *   ></div>
 *   <script src="/liri-sdk.js" async></script>
 *
 * ── Sécurité ───────────────────────────────────────────────────────────────
 * Sans API key : authentification par Origin (whitelist tenant_domains).
 * Avec API key : authentification totale, toutes opérations disponibles.
 * L'API key NE DOIT PAS être exposée dans un site public (front-end only).
 * Pour les sites publics, utilisez un proxy serveur qui détient l'API key.
 * ═══════════════════════════════════════════════════════════════════════════
 */
(function (global) {
  'use strict';

  var VERSION = '2.0.0';
  var DEFAULT_API_BASE = 'https://api.prorascience.org';
  var DEFAULT_APP_BASE = 'https://app.prorascience.org';
  var DEFAULT_HEIGHT = 560;
  var HOST_HEIGHT = 720;
  var WIDGET_ATTR = 'data-liri-mounted';

  // ── Helpers ────────────────────────────────────────────────────────────────

  function resolveBases(scriptSrc) {
    try {
      var url = new URL(scriptSrc);
      var appBase = url.origin;
      var apiBase = appBase.replace(/^(https?:\/\/)app\./, '$1api.');
      return { appBase: appBase, apiBase: apiBase };
    } catch (e) {
      return { appBase: DEFAULT_APP_BASE, apiBase: DEFAULT_API_BASE };
    }
  }

  function getScriptBases() {
    var scripts = document.querySelectorAll('script[src*="liri-sdk"], script[src*="liri-widget"]');
    var src = scripts.length > 0 ? scripts[scripts.length - 1].src : '';
    return resolveBases(src);
  }

  function qs(selector, ctx) {
    if (!selector) return null;
    if (typeof selector === 'string') return (ctx || document).querySelector(selector);
    return selector;
  }

  function el(tag, attrs, styles) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (styles) e.style.cssText = styles;
    return e;
  }

  function createIframe(src, height, theme) {
    var f = document.createElement('iframe');
    f.src = src;
    f.style.cssText = [
      'width:100%',
      'height:' + (parseInt(height, 10) || DEFAULT_HEIGHT) + 'px',
      'border:none',
      'border-radius:12px',
      'background:' + (theme === 'light' ? '#ffffff' : '#0d1117'),
      'display:block',
    ].join(';');
    f.setAttribute('allow', 'camera; microphone; autoplay; fullscreen; display-capture; screen-wake-lock');
    f.setAttribute('allowfullscreen', '');
    f.setAttribute('title', 'LIRI Live');
    return f;
  }

  function createLoader(height, theme, label) {
    var wrap = el('div', {}, [
      'width:100%',
      'height:' + (parseInt(height, 10) || DEFAULT_HEIGHT) + 'px',
      'border-radius:12px',
      'background:' + (theme === 'light' ? '#f9fafb' : '#0d1117'),
      'border:1px solid ' + (theme === 'light' ? '#e5e7eb' : '#21262d'),
      'display:flex', 'align-items:center', 'justify-content:center',
      'flex-direction:column', 'gap:12px',
      'font-family:system-ui,sans-serif',
    ].join(';'));

    var style = el('style');
    style.textContent = '@keyframes liri-spin{to{transform:rotate(360deg)}}';

    var spinner = el('div', {}, [
      'width:32px', 'height:32px',
      'border:3px solid ' + (theme === 'light' ? '#e5e7eb' : '#21262d'),
      'border-top:3px solid #7c3aed',
      'border-radius:50%',
      'animation:liri-spin 0.8s linear infinite',
    ].join(';'));

    var txt = el('p', {}, 'color:' + (theme === 'light' ? '#6b7280' : '#8b949e') + ';font-size:13px;margin:0;');
    txt.textContent = label || 'Chargement…';

    wrap.appendChild(style);
    wrap.appendChild(spinner);
    wrap.appendChild(txt);
    return { wrap: wrap, label: txt, spinner: spinner };
  }

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  function apiFetch(apiBase, path, method, body, apiKey) {
    var headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-Liri-Api-Key'] = apiKey;
    return fetch(apiBase + path, {
      method: method || 'GET',
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.message || data.error || 'Erreur ' + res.status);
        return data;
      });
    });
  }

  // ── Core embed ─────────────────────────────────────────────────────────────

  function embedCore(opts) {
    // opts: { container, tenant, session, role, height, theme, apiKey, apiBase, appBase,
    //         displayName, onJoined, onEnded, onError, onParticipantJoined, onParticipantLeft }

    if (!opts.tenant || !opts.session) {
      console.error('[LIRI SDK] tenant et session requis');
      return { unmount: function () {} };
    }

    var bases = getScriptBases();
    var apiBase = opts.apiBase || bases.apiBase;
    var appBase = opts.appBase || bases.appBase;
    var role = opts.role || 'viewer';
    var height = opts.height || (role === 'host' ? HOST_HEIGHT : DEFAULT_HEIGHT);
    var theme = opts.theme || 'dark';

    var container = qs(opts.container);
    if (!container) {
      console.error('[LIRI SDK] container introuvable:', opts.container);
      return { unmount: function () {} };
    }

    if (container.getAttribute(WIDGET_ATTR)) return { unmount: function () {} };
    container.setAttribute(WIDGET_ATTR, role);

    var loader = createLoader(height, theme, 'Connexion au live…');
    container.appendChild(loader.wrap);

    var iframe = null;
    var destroyed = false;
    var handlers = {};

    function trigger(event, data) {
      (handlers[event] || []).forEach(function (fn) { try { fn(data); } catch (e) {} });
    }

    function onMessage(event) {
      if (!event.data || typeof event.data !== 'object') return;
      switch (event.data.type) {
        case 'LIRI_SESSION_JOINED':
          trigger('session:joined', { sessionId: event.data.sessionId, room: event.data.room });
          if (typeof opts.onJoined === 'function') opts.onJoined({ sessionId: event.data.sessionId, room: event.data.room });
          break;
        case 'LIRI_SESSION_ENDED':
          trigger('session:ended', { sessionId: event.data.sessionId });
          if (typeof opts.onEnded === 'function') opts.onEnded();
          break;
        case 'LIRI_ERROR':
          trigger('error', { message: event.data.message });
          if (typeof opts.onError === 'function') opts.onError(event.data.message);
          break;
        case 'LIRI_PARTICIPANT_JOINED':
          trigger('participant:joined', event.data.participant || {});
          if (typeof opts.onParticipantJoined === 'function') opts.onParticipantJoined(event.data.participant);
          break;
        case 'LIRI_PARTICIPANT_LEFT':
          trigger('participant:left', event.data.participant || {});
          if (typeof opts.onParticipantLeft === 'function') opts.onParticipantLeft(event.data.participant);
          break;
      }
    }
    window.addEventListener('message', onMessage);

    // Obtenir le token embed
    var tokenPromise;
    if (opts.apiKey) {
      // Flow API key : appel REST v1
      tokenPromise = apiFetch(
        apiBase,
        '/v1/liri/sessions/' + opts.session + '/embed-token',
        'POST',
        { role: role, display_name: opts.displayName },
        opts.apiKey,
      ).then(function (res) { return res.data || res; });
    } else {
      // Flow Origin : widget public
      tokenPromise = apiFetch(apiBase, '/lives/embed/token', 'POST', {
        tenant: opts.tenant,
        session: opts.session,
        role: role,
      }).then(function (res) { return res.data || res; });
    }

    tokenPromise
      .then(function (data) {
        if (destroyed) return;
        var iframeSrc = data.iframe_url;
        if (!iframeSrc) throw new Error('iframe_url manquant');

        iframe = createIframe(iframeSrc, height, theme);
        container.replaceChild(iframe, loader.wrap);
      })
      .catch(function (err) {
        if (destroyed) return;
        console.error('[LIRI SDK]', err.message);
        loader.label.textContent = err.message || 'Impossible de charger le live';
        loader.label.style.color = '#f87171';
        loader.spinner.style.display = 'none';
        if (typeof opts.onError === 'function') opts.onError(err.message);
      });

    var instance = {
      on: function (event, fn) { handlers[event] = (handlers[event] || []); handlers[event].push(fn); return instance; },
      resize: function (newHeight) {
        if (iframe) iframe.style.height = newHeight + 'px';
      },
      unmount: function () {
        destroyed = true;
        window.removeEventListener('message', onMessage);
        container.removeAttribute(WIDGET_ATTR);
        if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
        if (loader.wrap.parentNode) loader.wrap.parentNode.removeChild(loader.wrap);
      },
    };

    return instance;
  }

  // ── Classe principale LiriSDK ──────────────────────────────────────────────

  function LiriInstance(config) {
    // config : { tenant, apiKey?, apiBase?, appBase? }
    var bases = getScriptBases();
    this._tenant = config.tenant;
    this._apiKey = config.apiKey || null;
    this._apiBase = config.apiBase || bases.apiBase;
    this._appBase = config.appBase || bases.appBase;
    this._globalHandlers = {};
  }

  LiriInstance.prototype.on = function (event, fn) {
    this._globalHandlers[event] = (this._globalHandlers[event] || []);
    this._globalHandlers[event].push(fn);
    return this;
  };

  function mergeOpts(inst, extra) {
    return Object.assign({}, extra, {
      tenant: extra.tenant || inst._tenant,
      apiKey: extra.apiKey || inst._apiKey,
      apiBase: extra.apiBase || inst._apiBase,
      appBase: extra.appBase || inst._appBase,
    });
  }

  /** Embed viewer (lecture seule) */
  LiriInstance.prototype.viewer = function (container, opts) {
    return embedCore(mergeOpts(this, Object.assign({}, opts, { container: container, role: 'viewer' })));
  };

  /** Embed hôte (caméra, micro, partage écran, modération) */
  LiriInstance.prototype.host = function (container, opts) {
    return embedCore(mergeOpts(this, Object.assign({}, opts, { container: container, role: 'host' })));
  };

  /** Embed co-hôte (caméra/micro, pas roomAdmin) */
  LiriInstance.prototype.coHost = function (container, opts) {
    return embedCore(mergeOpts(this, Object.assign({}, opts, { container: container, role: 'co_host' })));
  };

  /** Méthode générique (rôle explicite) */
  LiriInstance.prototype.embed = function (container, opts) {
    return embedCore(mergeOpts(this, Object.assign({}, opts, { container: container })));
  };

  // ── API REST (nécessite apiKey) ────────────────────────────────────────────

  LiriInstance.prototype._api = function (path, method, body) {
    if (!this._apiKey) {
      return Promise.reject(new Error('[LIRI SDK] apiKey requis pour les opérations API'));
    }
    return apiFetch(this._apiBase, '/v1/liri' + path, method, body, this._apiKey);
  };

  /** Crée une session live */
  LiriInstance.prototype.createSession = function (opts) {
    return this._api('/sessions', 'POST', opts);
  };

  /** Liste toutes les sessions du tenant */
  LiriInstance.prototype.getSessions = function (params) {
    var q = '';
    if (params) {
      var parts = [];
      if (params.status) parts.push('status=' + params.status);
      if (params.type) parts.push('type=' + params.type);
      if (params.limit) parts.push('limit=' + params.limit);
      if (q) q = '?' + parts.join('&');
    }
    return this._api('/sessions' + q, 'GET');
  };

  /** Récupère une session par ID */
  LiriInstance.prototype.getSession = function (sessionId) {
    return this._api('/sessions/' + sessionId, 'GET');
  };

  /** Met à jour une session */
  LiriInstance.prototype.updateSession = function (sessionId, patch) {
    return this._api('/sessions/' + sessionId, 'PATCH', patch);
  };

  /** Démarre une session */
  LiriInstance.prototype.startSession = function (sessionId) {
    return this._api('/sessions/' + sessionId + '/start', 'POST');
  };

  /** Termine une session */
  LiriInstance.prototype.endSession = function (sessionId) {
    return this._api('/sessions/' + sessionId + '/end', 'POST');
  };

  /** Supprime une session */
  LiriInstance.prototype.deleteSession = function (sessionId) {
    return this._api('/sessions/' + sessionId, 'DELETE');
  };

  /** Salle d'attente : liste */
  LiriInstance.prototype.getWaitingRoom = function (sessionId) {
    return this._api('/sessions/' + sessionId + '/waiting-room', 'GET');
  };

  /** Salle d'attente : admettre */
  LiriInstance.prototype.admit = function (sessionId, waitingId) {
    return this._api('/sessions/' + sessionId + '/waiting-room/' + waitingId + '/admit', 'POST');
  };

  /** Salle d'attente : rejeter */
  LiriInstance.prototype.reject = function (sessionId, waitingId) {
    return this._api('/sessions/' + sessionId + '/waiting-room/' + waitingId + '/reject', 'POST');
  };

  /** Recordings */
  LiriInstance.prototype.getRecordings = function (sessionId) {
    return this._api(sessionId ? '/sessions/' + sessionId + '/recordings' : '/recordings', 'GET');
  };

  // ── IA : Transcription / Résumé / Traduction / Neuro Recall ──────────────

  /** Transcrit l'enregistrement d'une session (Whisper) */
  LiriInstance.prototype.transcribe = function (sessionId, opts) {
    return this._api('/sessions/' + sessionId + '/transcribe', 'POST', opts || {});
  };

  /** Résumé IA depuis le transcript (DeepSeek) */
  LiriInstance.prototype.summarize = function (sessionId, opts) {
    return this._api('/sessions/' + sessionId + '/summary', 'POST', opts || {});
  };

  /** Traduit le transcript vers N langues */
  LiriInstance.prototype.translate = function (sessionId, targetLangs, mode) {
    return this._api('/sessions/' + sessionId + '/translate', 'POST', {
      target_langs: targetLangs || ['en'],
      mode: mode || 'live',
    });
  };

  /** Génère un deck Neuro Recall depuis le transcript */
  LiriInstance.prototype.generateRecallDeck = function (sessionId, opts) {
    return this._api('/sessions/' + sessionId + '/neuro-recall-deck', 'POST', opts || {});
  };

  /** Webhooks */
  LiriInstance.prototype.createWebhook = function (opts) {
    return this._api('/webhooks', 'POST', opts);
  };

  LiriInstance.prototype.getWebhooks = function () {
    return this._api('/webhooks', 'GET');
  };

  LiriInstance.prototype.deleteWebhook = function (id) {
    return this._api('/webhooks/' + id, 'DELETE');
  };

  /** Clés API */
  LiriInstance.prototype.createApiKey = function (label) {
    return this._api('/api-keys', 'POST', { label: label });
  };

  LiriInstance.prototype.getApiKeys = function () {
    return this._api('/api-keys', 'GET');
  };

  LiriInstance.prototype.revokeApiKey = function (id) {
    return this._api('/api-keys/' + id, 'DELETE');
  };

  // ── Auto-mount : éléments .liri-live[data-*] ──────────────────────────────

  function autoMount() {
    var elements = document.querySelectorAll('.liri-live:not([' + WIDGET_ATTR + '])');
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var tenant = el.getAttribute('data-tenant');
      var session = el.getAttribute('data-session');
      if (!tenant || !session) continue;

      embedCore({
        container: el,
        tenant: tenant,
        session: session,
        role: el.getAttribute('data-role') || 'viewer',
        height: el.getAttribute('data-height') || DEFAULT_HEIGHT,
        theme: el.getAttribute('data-theme') || 'dark',
        apiKey: el.getAttribute('data-api-key') || undefined,
        apiBase: el.getAttribute('data-api-base') || undefined,
        appBase: el.getAttribute('data-app-base') || undefined,
        displayName: el.getAttribute('data-display-name') || undefined,
      });
    }
  }

  // ── API Publique ───────────────────────────────────────────────────────────

  var LiriSDK = {
    version: VERSION,
    /** Initialise une instance LIRI SDK */
    init: function (config) {
      return new LiriInstance(config || {});
    },
    /** Mount direct (sans instance) */
    mount: function (opts) {
      return embedCore(opts);
    },
    /** Auto-mount manuel */
    autoMount: autoMount,
    /** Compatibilité LiriWidget v1 */
    LiriWidget: {
      version: '1.x→2.x',
      mount: function (opts) { return embedCore(opts); },
      autoMount: autoMount,
    },
  };

  // Exposition globale
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LiriSDK;
  } else {
    global.LiriSDK = LiriSDK;
    // Compatibilité backwards avec liri-widget.js
    global.LiriWidget = LiriSDK.LiriWidget;
  }

  // Auto-mount au chargement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    setTimeout(autoMount, 0);
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
