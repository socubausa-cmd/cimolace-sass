/*!
 * Cimolace SDK universel — v0.2.0
 * Embarque N'IMPORTE QUEL moteur Cimolace (LIRI live, MEDOS, mbolo…) dans
 * N'IMPORTE QUEL site, via une seule API : `Cimolace.mount({ engine, ... })`.
 *
 * Objectif produit (cf. docs/CAHIER_DE_CHARGE_CIMOLACE.md §6) : unifier les
 * anciens SDK fragmentés (liri-sdk.js hardcodé prorascience + medos/v1/embed.js
 * sur une autre origine) derrière une convention unique, avec un postMessage
 * SÉCURISÉ (origine vérifiée — fin du targetOrigin '*').
 *
 * Framework-agnostique (UMD/ESM). Aucune dépendance. Fonctionne par :
 *   1. Script tag + data-attributs  (auto-mount)
 *   2. Appel programmatique          Cimolace.mount({...})
 *
 * Certains moteurs sont ASYNC : ils mintent d'abord un jeton court côté serveur
 * avant de connaître l'URL finale de l'iframe (ex. LIRI live → POST
 * /lives/embed/token qui renvoie une iframe_url signée `…?et=…`). `mount()`
 * gère les deux cas (sync/async) de façon transparente.
 *
 * ⚠️ Sécurité : une clé API (`cml_…`) ne doit JAMAIS être exposée dans un site
 * public. Pour les modes identifiés (patient précis, panier serveur…), passez
 * par un proxy serveur qui détient la clé et fournit au SDK un `token` court.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; // CJS
  root.Cimolace = api; // navigateur / UMD
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── Bases neutres (JAMAIS de tenant en dur — cf. cloison des realms) ────────
  var DEFAULT_API_BASE = 'https://api.cimolace.space';
  var DEFAULT_APP_BASE = 'https://app.cimolace.space';
  var MED_BASE = 'https://med.cimolace.space';

  /**
   * Registre des moteurs. Un moteur expose SOIT :
   *   - `iframeUrl(o, bases)` → string  : URL directe, connue côté client (sync) ;
   *   - `resolveSrc(o, bases)` → Promise<string> : URL obtenue après un appel
   *     serveur (mint d'un jeton court). `mount()` affiche l'iframe une fois
   *     résolue, et vérifie le postMessage contre l'origine RÉELLE de cette URL.
   */
  var ENGINES = {
    liri: {
      label: 'LIRI Live',
      status: 'ready', // routes /embed/live/:id et /embed/studio déployées
      // LIRI live exige un embed-token court (JWT 30 min) minté par
      // POST /lives/embed/token (Origin vérifié contre tenant_domains). On
      // récupère l'iframe_url PRÊTE (`…/embed/live/:id?et=…&tenant=…`) telle
      // que renvoyée par l'API — jamais reconstruite à la main, sinon la page
      // /embed/live reste bloquée sur le spinner (paramètre `et=` manquant).
      resolveSrc: function (o, bases) {
        var tenant = required(o, 'tenant');
        var session = required(o, 'liveId');
        // Le flux public (Origin) n'autorise que viewer|co_host (jamais host :
        // pour héberger, passer par le flux clé API côté serveur).
        var role = (o.role === 'co_host' || o.mode === 'co_host') ? 'co_host' : 'viewer';
        return postJson(join(bases.apiBase, '/lives/embed/token'), {
          tenant: tenant,
          session: session,
          role: role,
        }).then(function (res) {
          var data = res && res.data ? res.data : res;
          var url = data && data.iframe_url;
          if (!url) throw new Error('iframe_url manquant dans la réponse embed-token');
          return url;
        });
      },
    },
    medos: {
      label: 'MEDOS',
      status: 'ready',
      // Le SEUL embed MEDOS iframe-able en prod = le HANDOFF SSO : un code à usage
      // unique minté PAR VOTRE BACKEND (POST /v1/medos/embed/practitioner-token,
      // clé mdk_) que le SDK échange dans med.cimolace.space/handoff. Le code (=
      // `token`) n'expose jamais la clé API dans le navigateur.
      iframeUrl: function (o, bases) {
        var code = required(o, 'token');
        return join(bases.medBase, '/handoff') + query({ code: code, next: o.next || undefined });
      },
    },
    mbolo: {
      label: 'mbolo storefront',
      // READY : catalogue PUBLIC par slug — /embed/boutique lit
      // GET /v1/mbolo/embed/:slug/catalog (aucune clé exposée au navigateur).
      status: 'ready',
      iframeUrl: function (o, bases) {
        var q = query({ tenant: required(o, 'tenant'), category: o.category || undefined, theme: o.theme });
        return join(bases.appBase, '/embed/boutique') + q;
      },
    },
  };

  // ── Utilitaires ─────────────────────────────────────────────────────────────
  function required(o, k) {
    if (!o || o[k] == null || o[k] === '') throw new Error('[Cimolace SDK] option requise: ' + k);
    return o[k];
  }
  function origin(u) { try { return new URL(u).origin; } catch (e) { return u; } }
  function join(base, path) { return String(base).replace(/\/+$/, '') + path; }
  function query(params) {
    var parts = [];
    for (var k in params) {
      if (Object.prototype.hasOwnProperty.call(params, k) && params[k] != null && params[k] !== '') {
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
      }
    }
    return parts.length ? '?' + parts.join('&') : '';
  }
  // POST JSON minimal (aucune clé exposée : le endpoint embed vérifie l'Origin).
  function postJson(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      credentials: 'omit',
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error((data && (data.message || data.error)) || ('Erreur ' + res.status));
        return data;
      });
    });
  }
  function resolveContainer(c) {
    if (!c) throw new Error('[Cimolace SDK] container requis');
    if (typeof c === 'string') {
      var el = document.querySelector(c);
      if (!el) throw new Error('[Cimolace SDK] container introuvable: ' + c);
      return el;
    }
    return c;
  }
  function resolveBases(opts) {
    return {
      apiBase: opts.apiBase || DEFAULT_API_BASE,
      appBase: opts.appBase || DEFAULT_APP_BASE,
      medBase: opts.medBase || MED_BASE,
    };
  }

  // ── Cœur : monte un moteur dans un container via iframe sécurisée ───────────
  function mount(opts) {
    opts = opts || {};
    var engineKey = required(opts, 'engine');
    var engine = ENGINES[engineKey];
    if (!engine) throw new Error('[Cimolace SDK] moteur inconnu: ' + engineKey + ' (attendus: ' + Object.keys(ENGINES).join(', ') + ')');

    var container = resolveContainer(opts.container);
    var bases = resolveBases(opts);

    // Moteur en PREVIEW : sa route d'embed publique n'est pas encore déployée.
    // On rend un placeholder clair plutôt qu'une iframe cassée (fallback SPA).
    if (engine.status === 'preview') {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Cimolace SDK] moteur « ' + engineKey + ' » en PREVIEW : route d\'embed publique pas encore déployée.');
      }
      var ph = document.createElement('div');
      ph.setAttribute('data-cimolace-preview', engineKey);
      ph.style.cssText = 'padding:24px;border:1px dashed rgba(153,153,153,.4);border-radius:12px;font:14px/1.5 system-ui,sans-serif;color:#888;text-align:center';
      ph.textContent = engine.label + ' — intégration bientôt disponible.';
      container.appendChild(ph);
      return { iframe: null, post: function () {}, unmount: function () { if (ph.parentNode) ph.parentNode.removeChild(ph); } };
    }

    // Origine attendue du postMessage : verrouillée sur l'URL RÉELLE de l'iframe
    // une fois celle-ci connue (sync ou après résolution async). Tant qu'elle est
    // nulle, aucun message n'est accepté (l'iframe n'a de toute façon pas de src).
    var expectedOrigin = null;

    var iframe = document.createElement('iframe');
    iframe.title = engine.label;
    iframe.setAttribute('allow', 'camera; microphone; autoplay; clipboard-write; fullscreen; picture-in-picture');
    iframe.style.width = '100%';
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.style.height = (opts.height ? opts.height : 640) + 'px';
    container.appendChild(iframe);

    function applySrc(src) {
      expectedOrigin = origin(src);
      iframe.src = src;
    }

    if (typeof engine.resolveSrc === 'function') {
      // Moteur ASYNC : mint côté serveur (ex. LIRI embed-token) puis iframe.
      iframe.setAttribute('data-cimolace-loading', engineKey);
      Promise.resolve()
        .then(function () { return engine.resolveSrc(opts, bases); })
        .then(function (src) {
          iframe.removeAttribute('data-cimolace-loading');
          applySrc(src);
        })
        .catch(function (err) {
          var msg = err && err.message ? err.message : String(err);
          if (typeof console !== 'undefined' && console.error) {
            console.error('[Cimolace SDK] moteur « ' + engineKey + ' » : ' + msg);
          }
          // Remplace l'iframe par un message d'erreur lisible (pas d'iframe cassée).
          var errBox = document.createElement('div');
          errBox.setAttribute('data-cimolace-error', engineKey);
          errBox.style.cssText = 'padding:24px;border:1px solid rgba(220,80,80,.35);border-radius:12px;font:14px/1.5 system-ui,sans-serif;color:#c0392b;text-align:center';
          errBox.textContent = engine.label + ' — ' + msg;
          if (iframe.parentNode) iframe.parentNode.replaceChild(errBox, iframe);
          if (typeof opts.onEvent === 'function') {
            try { opts.onEvent({ source: 'cimolace', type: 'error', message: msg }); } catch (e) { /* no-op */ }
          }
        });
    } else {
      // Moteur SYNC (MEDOS handoff, mbolo boutique) : URL construite directement.
      applySrc(engine.iframeUrl(opts, bases));
    }

    // postMessage SÉCURISÉ : on N'accepte QUE les messages provenant de
    // l'origine attendue de l'iframe (fin du '*' non filtré). Protocole minimal :
    // { source:'cimolace', type:'resize'|'ready'|'event', height?, payload? }.
    function onMessage(ev) {
      if (!expectedOrigin || ev.origin !== expectedOrigin) return; // origine non fiable → ignore
      if (ev.source !== iframe.contentWindow) return;              // pas notre iframe → ignore
      var d = ev.data;
      if (!d || d.source !== 'cimolace') return;
      if (d.type === 'resize' && typeof d.height === 'number' && d.height > 0) {
        iframe.style.height = d.height + 'px';
      }
      if (typeof opts.onEvent === 'function') {
        try { opts.onEvent(d); } catch (e) { /* le hôte ne doit pas casser le SDK */ }
      }
    }
    window.addEventListener('message', onMessage);

    // API vers l'iframe : toujours ciblée sur l'origine attendue (jamais '*').
    function post(type, payload) {
      if (iframe.contentWindow && expectedOrigin) {
        iframe.contentWindow.postMessage({ source: 'cimolace-host', type: type, payload: payload }, expectedOrigin);
      }
    }

    return {
      iframe: iframe,
      post: post,
      unmount: function () {
        window.removeEventListener('message', onMessage);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      },
    };
  }

  // ── Auto-mount : <div data-cimolace-engine="liri" data-live-id="…" …> ───────
  function autoMount(scopeEl) {
    var scope = scopeEl || document;
    var nodes = scope.querySelectorAll('[data-cimolace-engine]:not([data-cimolace-mounted])');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      try {
        mount({
          engine: el.getAttribute('data-cimolace-engine'),
          container: el,
          tenant: el.getAttribute('data-tenant') || undefined,
          liveId: el.getAttribute('data-live-id') || undefined,
          mode: el.getAttribute('data-mode') || undefined,
          role: el.getAttribute('data-role') || undefined,
          token: el.getAttribute('data-token') || undefined,
          theme: el.getAttribute('data-theme') || undefined,
          category: el.getAttribute('data-category') || undefined,
          next: el.getAttribute('data-next') || undefined,
          height: el.getAttribute('data-height') ? Number(el.getAttribute('data-height')) : undefined,
          apiBase: el.getAttribute('data-api-base') || undefined,
          appBase: el.getAttribute('data-app-base') || undefined,
          medBase: el.getAttribute('data-med-base') || undefined,
        });
        el.setAttribute('data-cimolace-mounted', '1');
      } catch (e) {
        if (window.console) console.error('[Cimolace SDK] auto-mount', e);
      }
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { autoMount(); });
    } else {
      autoMount();
    }
  }

  return {
    version: '0.2.0',
    engines: Object.keys(ENGINES),
    mount: mount,
    autoMount: autoMount,
    // exposé pour tests/extension
    _internals: { ENGINES: ENGINES, query: query, origin: origin, join: join, postJson: postJson },
  };
});
