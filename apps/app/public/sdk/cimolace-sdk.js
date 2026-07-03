/*!
 * Cimolace SDK universel — v0.1.0
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
   * Registre des moteurs : chaque entrée sait construire l'URL de l'iframe et,
   * pour les modes anonymes, quel endpoint émet le token court. `originOf`
   * renvoie l'origine attendue de l'iframe → base du contrôle postMessage.
   */
  var ENGINES = {
    liri: {
      label: 'LIRI Live',
      // /embed/live/:id sur l'app (le hôte fournit liveId).
      iframeUrl: function (o, bases) {
        var id = required(o, 'liveId');
        var q = query({ tenant: o.tenant, mode: o.mode, theme: o.theme });
        return join(bases.appBase, '/embed/live/' + encodeURIComponent(id)) + q;
      },
      originOf: function (bases) { return origin(bases.appBase); },
    },
    medos: {
      label: 'MEDOS',
      // Widget praticien/patient hébergé sur med.cimolace.space.
      iframeUrl: function (o, bases) {
        var q = query({
          tenant: required(o, 'tenant'),
          mode: o.mode || 'patient-portal',
          token: o.token || undefined,
          theme: o.theme,
        });
        return join(bases.medBase, '/embed') + q;
      },
      originOf: function (bases) { return origin(bases.medBase); },
    },
    mbolo: {
      label: 'mbolo storefront',
      iframeUrl: function (o, bases) {
        var q = query({ tenant: required(o, 'tenant'), mode: o.mode || 'storefront', theme: o.theme });
        return join(bases.appBase, '/embed/boutique') + q;
      },
      originOf: function (bases) { return origin(bases.appBase); },
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
    var src = engine.iframeUrl(opts, bases);
    var expectedOrigin = engine.originOf(bases);

    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.title = engine.label;
    iframe.setAttribute('allow', 'camera; microphone; autoplay; clipboard-write; fullscreen; picture-in-picture');
    iframe.style.width = '100%';
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.style.height = (opts.height ? opts.height : 640) + 'px';
    container.appendChild(iframe);

    // postMessage SÉCURISÉ : on N'accepte QUE les messages provenant de
    // l'origine attendue de l'iframe (fin du '*' non filtré). Protocole minimal :
    // { source:'cimolace', type:'resize'|'ready'|'event', height?, payload? }.
    function onMessage(ev) {
      if (ev.origin !== expectedOrigin) return;         // origine non fiable → ignore
      if (ev.source !== iframe.contentWindow) return;    // pas notre iframe → ignore
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
      if (iframe.contentWindow) {
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
          token: el.getAttribute('data-token') || undefined,
          theme: el.getAttribute('data-theme') || undefined,
          height: el.getAttribute('data-height') ? Number(el.getAttribute('data-height')) : undefined,
          apiBase: el.getAttribute('data-api-base') || undefined,
          appBase: el.getAttribute('data-app-base') || undefined,
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
    version: '0.1.0',
    engines: Object.keys(ENGINES),
    mount: mount,
    autoMount: autoMount,
    // exposé pour tests/extension
    _internals: { ENGINES: ENGINES, query: query, origin: origin, join: join },
  };
});
