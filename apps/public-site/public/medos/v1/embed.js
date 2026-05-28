/* MEDOS embed widget — version v1 (MVP)
 *
 * Comment l'utiliser :
 *
 *   <div id="medos-portal"></div>
 *   <script
 *     src="https://cdn.cimolace.com/medos/v1/embed.js"
 *     data-tenant="zahirwellness"
 *     data-mode="patient-portal"
 *     data-api-base="https://api.cimolace.com"
 *     async></script>
 *
 * Modes supportés (MVP) :
 *   - patient-portal  : liste les notes partagées (lecture seule)
 *   - consent-form    : affiche le formulaire de consentement à signer
 *   - health-tracker  : permet d'ajouter une entrée santé
 *
 * Pré-requis côté Cimolace :
 *   - Le domaine du site appelant doit être whitelisté dans tenant_domains
 *     (usage='embed_origin') pour le tenant cible
 *   - MEDOS doit être activé sur le tenant
 *
 * Sécurité :
 *   - Le widget n'embarque aucun secret
 *   - L'auth se fait via embed-token JWT court (15 min), réclamé à Cimolace
 *     qui vérifie l'Origin contre tenant_domains
 *   - Le rendu utilise un Shadow DOM pour isoler les styles du site host
 */
(function () {
  "use strict";

  var SCRIPT_TAG = document.currentScript;
  if (!SCRIPT_TAG) {
    console.error("[medos-embed] document.currentScript indisponible — abandon");
    return;
  }

  var TENANT_SLUG = SCRIPT_TAG.getAttribute("data-tenant");
  var MODE = SCRIPT_TAG.getAttribute("data-mode") || "patient-portal";
  var API_BASE =
    SCRIPT_TAG.getAttribute("data-api-base") || "https://api.cimolace.com";
  var TARGET_SELECTOR =
    SCRIPT_TAG.getAttribute("data-target") || "#medos-portal";
  var PRIMARY_COLOR =
    SCRIPT_TAG.getAttribute("data-primary-color") || "#4f46e5";

  var VALID_MODES = [
    "patient-portal",
    "consent-form",
    "intake-form",
    "health-tracker",
    "appointment-booker",
  ];

  if (!TENANT_SLUG) {
    console.error('[medos-embed] data-tenant manquant sur la balise <script>');
    return;
  }
  if (VALID_MODES.indexOf(MODE) === -1) {
    console.error('[medos-embed] data-mode invalide :', MODE);
    return;
  }

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    var host = document.querySelector(TARGET_SELECTOR);
    if (!host) {
      console.error(
        "[medos-embed] cible introuvable :",
        TARGET_SELECTOR,
        "— ajoutez <div id=\"medos-portal\"></div> avant le script",
      );
      return;
    }

    var shadow = host.attachShadow({ mode: "open" });
    injectStyles(shadow);

    var root = document.createElement("div");
    root.className = "medos-root";
    shadow.appendChild(root);

    renderLoading(root);

    fetchEmbedToken()
      .then(function (data) {
        renderMode(root, data);
      })
      .catch(function (err) {
        renderError(root, err && err.message ? err.message : String(err));
      });
  });

  // ─── Auth ────────────────────────────────────────────────────────────────

  function fetchEmbedToken() {
    return fetch(API_BASE + "/v1/medos/embed/token", {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_slug: TENANT_SLUG, mode: MODE }),
    }).then(function (res) {
      if (!res.ok) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (body) {
            var msg =
              (body && body.error && body.error.message) ||
              "Embed token refusé (HTTP " + res.status + ")";
            throw new Error(msg);
          });
      }
      return res.json().then(function (body) {
        return body.data || body;
      });
    });
  }

  function callApi(path, opts, token) {
    opts = opts || {};
    return fetch(API_BASE + path, {
      method: opts.method || "GET",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (res) {
      if (!res.ok) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (body) {
            var msg =
              (body && body.error && body.error.message) ||
              "API error " + res.status;
            throw new Error(msg);
          });
      }
      return res.json().then(function (b) {
        return b.data !== undefined ? b.data : b;
      });
    });
  }

  // ─── Rendu ───────────────────────────────────────────────────────────────

  function renderLoading(root) {
    root.innerHTML =
      '<div class="medos-loading"><div class="medos-spinner"></div><p>Chargement MEDOS...</p></div>';
  }

  function renderError(root, message) {
    root.innerHTML = "";
    var box = document.createElement("div");
    box.className = "medos-error";
    box.innerHTML =
      '<p class="medos-error-title">Impossible de charger MEDOS</p>' +
      '<p class="medos-error-msg"></p>';
    box.querySelector(".medos-error-msg").textContent = message;
    root.appendChild(box);
  }

  function renderMode(root, auth) {
    if (MODE === "patient-portal") return renderPatientPortal(root, auth);
    if (MODE === "consent-form") return renderConsentForm(root, auth);
    if (MODE === "health-tracker") return renderHealthTracker(root, auth);
    renderError(root, "Mode " + MODE + " non encore implémenté côté widget");
  }

  function renderPatientPortal(root, auth) {
    root.innerHTML =
      '<div class="medos-panel">' +
      '<h2 class="medos-heading">Mon dossier médical</h2>' +
      '<p class="medos-subtle">Notes partagées par mon praticien</p>' +
      '<ul class="medos-list" id="medos-notes-list">' +
      '<li class="medos-empty">Chargement...</li>' +
      "</ul>" +
      '<p class="medos-foot">Sécurisé · Conforme RGPD · Propulsé par Cimolace</p>' +
      "</div>";

    callApi("/med/me/notes", {}, auth.token)
      .then(function (notes) {
        var list = root.querySelector("#medos-notes-list");
        list.innerHTML = "";
        if (!notes || notes.length === 0) {
          list.innerHTML =
            '<li class="medos-empty">Aucune note partagée pour le moment.</li>';
          return;
        }
        notes.forEach(function (n) {
          var li = document.createElement("li");
          li.className = "medos-note";
          li.innerHTML =
            '<p class="medos-note-date"></p>' +
            '<p class="medos-note-assess"></p>' +
            '<p class="medos-note-plan"></p>';
          li.querySelector(".medos-note-date").textContent = fmtDate(
            n.signed_at || n.created_at,
          );
          li.querySelector(".medos-note-assess").textContent =
            n.assessment || "(évaluation non renseignée)";
          li.querySelector(".medos-note-plan").textContent = n.plan || "";
          list.appendChild(li);
        });
      })
      .catch(function (err) {
        renderError(root, err.message);
      });
  }

  function renderConsentForm(root, auth) {
    root.innerHTML =
      '<div class="medos-panel">' +
      '<h2 class="medos-heading">Consentement de soins</h2>' +
      '<form id="medos-consent-form" class="medos-form">' +
      '<label class="medos-check"><input type="checkbox" required /> Je confirme mon identité</label>' +
      '<label class="medos-check"><input type="checkbox" required /> J\'autorise le traitement de mes données médicales (RGPD)</label>' +
      '<label class="medos-check"><input type="checkbox" required /> J\'autorise le partage entre praticiens du cabinet</label>' +
      '<label class="medos-label">Personne à prévenir (nom + téléphone)' +
      '<input type="text" name="emergency_contact" required class="medos-input" /></label>' +
      '<button type="submit" class="medos-btn">Signer le consentement</button>' +
      "</form>" +
      '<p class="medos-foot" id="medos-consent-status"></p>' +
      "</div>";

    var form = root.querySelector("#medos-consent-form");
    var status = root.querySelector("#medos-consent-status");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.textContent = "Envoi en cours...";
      // Démo MVP : on n'a pas encore l'endpoint formulaire publique pour
      // soumettre sans patient_id préalable. On loggue juste localement.
      // L'intégration réelle se fait via Mode C.3 server-to-server pour
      // créer le patient + soumettre la réponse.
      setTimeout(function () {
        status.textContent =
          "Démo MVP : consentement enregistré localement. La soumission backend exige Mode C.3.";
        form.querySelector("button").disabled = true;
      }, 400);
    });
  }

  function renderHealthTracker(root, auth) {
    root.innerHTML =
      '<div class="medos-panel">' +
      '<h2 class="medos-heading">Mon journal santé</h2>' +
      '<form id="medos-health-form" class="medos-form">' +
      '<label class="medos-label">Humeur (1-10)' +
      '<input type="number" name="mood_score" min="1" max="10" required class="medos-input" /></label>' +
      '<label class="medos-label">Heures de sommeil' +
      '<input type="number" name="sleep_hours" min="0" max="24" step="0.5" class="medos-input" /></label>' +
      '<label class="medos-label">Notes (optionnel)' +
      '<textarea name="notes" rows="3" class="medos-input"></textarea></label>' +
      '<button type="submit" class="medos-btn">Enregistrer</button>' +
      "</form>" +
      '<p class="medos-foot" id="medos-health-status"></p>' +
      "</div>";

    var form = root.querySelector("#medos-health-form");
    var status = root.querySelector("#medos-health-status");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var payload = {
        mood_score: Number(fd.get("mood_score")),
        sleep_hours: fd.get("sleep_hours")
          ? Number(fd.get("sleep_hours"))
          : null,
        notes: fd.get("notes"),
        entry_type: "mood",
      };
      status.textContent = "Envoi...";
      callApi("/med/health", { method: "POST", body: payload }, auth.token)
        .then(function () {
          status.textContent = "Entrée enregistrée";
          form.reset();
        })
        .catch(function (err) {
          status.textContent = "Erreur : " + err.message;
        });
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function fmtDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("fr-FR", {
        dateStyle: "long",
        timeStyle: "short",
      });
    } catch (e) {
      return iso;
    }
  }

  function injectStyles(shadow) {
    var style = document.createElement("style");
    style.textContent = [
      ":host { all: initial; }",
      ".medos-root { font-family: system-ui, -apple-system, sans-serif; color: #111827; line-height: 1.5; }",
      ".medos-loading { display:flex; flex-direction:column; align-items:center; padding:48px 16px; color:#6b7280; }",
      ".medos-spinner { width:32px; height:32px; border:3px solid #e5e7eb; border-top-color:" +
        PRIMARY_COLOR +
        "; border-radius:50%; animation: medos-spin 0.8s linear infinite; margin-bottom:12px; }",
      "@keyframes medos-spin { to { transform: rotate(360deg); } }",
      ".medos-error { background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:16px; color:#991b1b; }",
      ".medos-error-title { font-weight:600; margin:0 0 4px; }",
      ".medos-error-msg { margin:0; font-size:14px; }",
      ".medos-panel { background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:24px; max-width:560px; }",
      ".medos-heading { margin:0 0 4px; font-size:20px; font-weight:700; }",
      ".medos-subtle { margin:0 0 16px; color:#6b7280; font-size:14px; }",
      ".medos-list { list-style:none; padding:0; margin:0; }",
      ".medos-note { background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:12px; margin-bottom:8px; }",
      ".medos-note-date { font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:0.04em; margin:0 0 4px; }",
      ".medos-note-assess { font-weight:600; margin:0 0 4px; }",
      ".medos-note-plan { color:#374151; font-size:14px; margin:0; white-space:pre-wrap; }",
      ".medos-empty { color:#6b7280; font-style:italic; padding:8px 0; }",
      ".medos-form { display:flex; flex-direction:column; gap:12px; }",
      ".medos-label { display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:500; color:#374151; }",
      ".medos-check { display:flex; align-items:flex-start; gap:8px; font-size:14px; cursor:pointer; }",
      ".medos-input { padding:8px 10px; border:1px solid #d1d5db; border-radius:6px; font:inherit; font-size:14px; }",
      ".medos-input:focus { outline:none; border-color:" +
        PRIMARY_COLOR +
        "; box-shadow: 0 0 0 3px " +
        PRIMARY_COLOR +
        "33; }",
      ".medos-btn { background:" +
        PRIMARY_COLOR +
        "; color:#fff; border:0; border-radius:8px; padding:10px 16px; font:inherit; font-weight:600; font-size:14px; cursor:pointer; }",
      ".medos-btn:disabled { opacity:0.5; cursor:not-allowed; }",
      ".medos-foot { font-size:11px; color:#9ca3af; text-align:center; margin-top:16px; }",
    ].join("\n");
    shadow.appendChild(style);
  }
})();
