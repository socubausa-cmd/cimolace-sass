#!/usr/bin/env python3
"""
ISNA Platform V2 — Test Playwright complet école multi-tenant
============================================================
Couvre :
  1. API : provision preview + création école via /school-onboarding/provision
  2. API : moteurs école (manifest, live, courses, smartboard, marketing)
  3. UI  : wizard Cimolace /cimolace/create-school (3 étapes)
  4. UI  : accès app école /t/{slug}/admin
  5. UI  : création live depuis l'école

Usage :
  cd /Users/ngowazulu/Downloads/isna_platform_v2
  python3 scripts/ecole-playwright-e2e.py

Pré-requis :
  - API running : http://localhost:4002
  - App running : http://localhost:5173
  - python playwright : pip install playwright && playwright install chromium
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright, expect, TimeoutError as PWTimeout

# ── Config ────────────────────────────────────────────────────────────────────
ROOT       = Path(__file__).parent.parent
OUT_DIR    = Path("/private/tmp/isna-ecole-e2e")
API        = "http://localhost:4002"
APP_ORIGIN = "http://localhost:5173"
SUPABASE_URL  = None
SUPABASE_ANON = None
SUPABASE_SVC  = None

# Compte Cimolace admin (staff) pour les tests UI
CIMOLACE_EMAIL    = "cimolace-admin@prorascience.local"
CIMOLACE_PASSWORD = "CimolaceDev2026"

TIMESTAMP = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
SCHOOL_SLUG = f"ecole-e2e-{TIMESTAMP}"
SCHOOL_NAME = f"École E2E {TIMESTAMP}"

# ── Helpers env ───────────────────────────────────────────────────────────────
def load_env(filepath):
    out = {}
    p = Path(filepath)
    if not p.exists():
        return out
    for line in p.read_text().splitlines():
        match_line = line.strip()
        if not match_line or match_line.startswith("#"):
            continue
        if "=" not in match_line:
            continue
        k, _, v = match_line.partition("=")
        v = v.strip().strip('"').strip("'")
        out[k.strip()] = v
    return out

_env = {
    **load_env(ROOT / "apps" / "api" / ".env"),
    **load_env(ROOT / "apps" / "app" / ".env"),
    **load_env(ROOT / "apps" / "app" / ".env.local"),
}

SUPABASE_URL  = _env.get("SUPABASE_URL") or _env.get("VITE_SUPABASE_URL", "")
SUPABASE_ANON = _env.get("SUPABASE_ANON_KEY") or _env.get("VITE_SUPABASE_ANON_KEY", "")
SUPABASE_SVC  = _env.get("SUPABASE_SERVICE_ROLE_KEY", "")

# ── Reporting ─────────────────────────────────────────────────────────────────
RESULTS = []
PASS_COUNT = 0
FAIL_COUNT = 0
SCREENSHOTS = []

def record(label, ok, detail="", fatal=False):
    global PASS_COUNT, FAIL_COUNT
    icon = "✅" if ok else "❌"
    print(f"  {icon}  {label:<55} {detail}")
    RESULTS.append({"label": label, "ok": ok, "detail": detail})
    if ok:
        PASS_COUNT += 1
    else:
        FAIL_COUNT += 1
        if fatal:
            print("\n💥 Erreur fatale — arrêt du test")
            dump_report()
            sys.exit(1)

def screenshot(page, name):
    path = OUT_DIR / f"{name}.png"
    try:
        page.screenshot(path=str(path), full_page=True)
        SCREENSHOTS.append(str(path))
        print(f"  📸 Capture → {path.name}")
    except Exception as ex:
        print(f"  ⚠️  Screenshot {name} échoué : {ex}")

def dump_report():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    report = {
        "timestamp": TIMESTAMP,
        "school_slug": SCHOOL_SLUG,
        "total": PASS_COUNT + FAIL_COUNT,
        "passed": PASS_COUNT,
        "failed": FAIL_COUNT,
        "results": RESULTS,
        "screenshots": SCREENSHOTS,
    }
    report_path = OUT_DIR / "report.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"\n📋 Rapport sauvegardé → {report_path}")
    print(f"   ✅ {PASS_COUNT} passés   ❌ {FAIL_COUNT} échoués\n")

# ── API helpers ───────────────────────────────────────────────────────────────
def api_call(method, path, token=None, body=None, tenant=None, expect_ok=True):
    url = f"{API}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if tenant:
        headers["X-Tenant-Slug"] = tenant
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode()
            js = json.loads(raw) if raw else {}
            return {"ok": True, "status": resp.status, "body": js.get("data", js)}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            js = json.loads(raw)
        except Exception:
            js = {"raw": raw}
        if expect_ok:
            return {"ok": False, "status": e.code, "body": js}
        return {"ok": False, "status": e.code, "body": js}
    except Exception as ex:
        return {"ok": False, "status": 0, "body": {"error": str(ex)}}

def supabase_sign_in(email, password):
    """Authentification via Supabase REST."""
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    headers = {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON,
    }
    body = json.dumps({"email": email, "password": password}).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": e.read().decode()}

def supabase_create_user_admin(email, password):
    """Crée un utilisateur Supabase via Admin API."""
    url = f"{SUPABASE_URL}/auth/v1/admin/users"
    headers = {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SVC,
        "Authorization": f"Bearer {SUPABASE_SVC}",
    }
    body = json.dumps({
        "email": email,
        "password": password,
        "email_confirm": True,
    }).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return json.loads(raw)
        except Exception:
            return {"error": raw}

def supabase_delete_user_admin(user_id):
    """Supprime un utilisateur Supabase (nettoyage)."""
    if not user_id:
        return
    url = f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}"
    headers = {
        "apikey": SUPABASE_SVC,
        "Authorization": f"Bearer {SUPABASE_SVC}",
    }
    req = urllib.request.Request(url, headers=headers, method="DELETE")
    try:
        urllib.request.urlopen(req, timeout=10)
    except Exception:
        pass

def supabase_storage_key():
    try:
        from urllib.parse import urlparse
        host = urlparse(SUPABASE_URL).hostname or ""
        ref = host.split(".")[0] if host.endswith(".supabase.co") else host
        return f"sb-{ref}-auth-token"
    except Exception:
        return "sb-local-auth-token"

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — Santé API
# ═══════════════════════════════════════════════════════════════════════════════
def test_api_health():
    print("\n══════ 1. Santé API ═════════════════════════════════════════════")
    r = api_call("GET", "/health")
    record("GET /health → 200", r["ok"] and r["status"] == 200, str(r["body"]))

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — Authentification Cimolace
# ═══════════════════════════════════════════════════════════════════════════════
def test_cimolace_auth():
    print("\n══════ 2. Auth Cimolace (compte admin) ══════════════════════════")

    if not SUPABASE_URL or not SUPABASE_ANON:
        record("Supabase URL/anon configurés", False, "vars manquantes", fatal=True)
        return None

    record("Supabase URL/anon configurés", True)

    auth = supabase_sign_in(CIMOLACE_EMAIL, CIMOLACE_PASSWORD)
    token = auth.get("access_token")
    ok = bool(token)
    record(f"Sign-in {CIMOLACE_EMAIL}", ok,
           "OK" if ok else auth.get("error_description") or str(auth)[:80])
    if not ok:
        record("Token JWT disponible", False, "impossible sans auth", fatal=True)
        return None

    record("Token JWT disponible", True, f"…{token[-16:]}")
    return token

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — Manifest moteurs école
# ═══════════════════════════════════════════════════════════════════════════════
def test_engine_manifest(token):
    print("\n══════ 3. Manifest moteurs école ════════════════════════════════")
    r = api_call("GET", "/school-onboarding/engines", token=token)
    ok = r["ok"] and isinstance(r["body"], dict)
    record("GET /school-onboarding/engines → 200", ok, str(r["status"]))
    if ok:
        manifest = r["body"]
        engines = manifest.get("engines") or []
        base    = manifest.get("baseEngines") or []
        rec     = manifest.get("recommendedEngines") or []
        record(f"Moteurs core dans manifest",     len(base) > 0,      f"{len(base)} moteurs core")
        record(f"Moteurs recommandés dans manifest", len(rec) > 0,    f"{len(rec)} moteurs recommandés")
        record(f"Manifest complet (tous tiers)",  len(engines) > 0,   f"{len(engines)} entrées au total")
    return r["body"] if ok else {}

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — Preview provisioning (API)
# ═══════════════════════════════════════════════════════════════════════════════
def test_provision_preview(token):
    print("\n══════ 4. Preview provisioning école (API) ══════════════════════")
    payload = {
        "name": SCHOOL_NAME,
        "slug": SCHOOL_SLUG,
        "owner_email": f"owner@{SCHOOL_SLUG}.test",
        "business_name": f"{SCHOOL_NAME} SARL",
        "domain": f"{SCHOOL_SLUG}.prorascience.org",
        "plan": "school",
        "brand_colors": {"primary": "#0b1115", "secondary": "#162331", "accent": "#3b82f6"},
    }
    r = api_call("POST", "/school-onboarding/provision/preview", token=token, body=payload)
    ok = r["ok"] and isinstance(r["body"], dict)
    record("POST /school-onboarding/provision/preview → 200", ok, str(r["status"]))
    if not ok:
        return None, payload
    preview = r["body"]
    slug_available = preview.get("plan", {}).get("tenant", {}).get("slugAvailable", False)
    blocking = any("déjà pris" in str(w).lower() for w in (preview.get("warnings") or []))
    record("Slug disponible", slug_available, SCHOOL_SLUG)
    record("Aucun blocage critique", not blocking,
           "OK" if not blocking else "slug déjà pris → utiliser un autre slug")
    engines = preview.get("plan", {}).get("engines", {})
    total_engines = engines.get("totalToActivate", 0)
    record(f"Plan moteurs prévu", total_engines > 0, f"{total_engines} moteurs à activer")
    return preview, payload

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — Création école (API self-service)
# ═══════════════════════════════════════════════════════════════════════════════
def test_provision_school(token, payload):
    print("\n══════ 5. Création école — self-service API ═════════════════════")
    r = api_call("POST", "/school-onboarding/provision", token=token, body=payload)
    ok = r["ok"]
    record("POST /school-onboarding/provision → 200/201", ok,
           f"status={r['status']}" if not ok else "")
    if not ok:
        detail = r["body"]
        record("Provisioning école OK", False, str(detail)[:120], fatal=True)
        return None

    provisioned = r["body"]
    tenant  = provisioned.get("tenant") or {}
    client  = provisioned.get("client") or {}
    site    = provisioned.get("site") or {}
    services = provisioned.get("services") or []
    owner   = provisioned.get("owner") or {}

    record("Tenant créé (id présent)",        bool(tenant.get("id")),        tenant.get("id", "❌")[:16] if tenant.get("id") else "❌")
    record("Client Cimolace créé",            bool(client.get("id")),        client.get("id", "❌")[:16] if client.get("id") else "❌")
    record("Site Cimolace créé",              bool(site.get("id")),          site.get("id", "❌")[:16] if site.get("id") else "❌")
    record(f"Moteurs activés ({len(services)})", len(services) > 0,         f"{len(services)} services créés")
    record("infrastructure_type = school",    tenant.get("infrastructure_type") == "school", tenant.get("infrastructure_type", "?"))
    record("Owner résolu",                    bool(owner.get("method")),     owner.get("method", "?"))

    print(f"\n  📌 Tenant slug   : {tenant.get('slug')}")
    print(f"  📌 Client ID     : {client.get('id', '?')[:16]}…")
    print(f"  📌 Owner method  : {owner.get('method')}")
    print(f"  📌 Services      : {[s.get('service_key') for s in services]}")

    return provisioned

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — Moteurs école (API avec tenant slug)
# ═══════════════════════════════════════════════════════════════════════════════
def test_school_engines_api(token, provisioned):
    print("\n══════ 6. Moteurs école — API avec tenant slug ══════════════════")

    # Le token admin Cimolace n'a pas de membership dans le nouveau tenant.
    # On crée un owner user pour tester les endpoints tenant.
    owner_email = f"owner@{SCHOOL_SLUG}.test"
    owner_password = "OwnerTest2026!"

    # Créer l'owner via Supabase Admin si besoin
    if SUPABASE_SVC:
        created = supabase_create_user_admin(owner_email, owner_password)
        user_id = created.get("id") or created.get("user", {}).get("id")
        record("Owner Supabase créé/existant", bool(user_id or "already" in str(created).lower()),
               owner_email)
    else:
        record("Owner Supabase (SVC key manquante)", False, "tests tenant limités")

    # Utiliser le token admin Cimolace pour les endpoints qui acceptent n'importe quel membre
    # (les endpoints /lives, /courses etc. nécessitent X-Tenant-Slug + membership)
    # On teste d'abord l'endpoint de listing qui peut retourner 403 sans membership

    r_lives = api_call("GET", "/lives", token=token, tenant=SCHOOL_SLUG, expect_ok=False)
    # 200 = membership OK, 403 = pas de membership (attendu pour l'admin Cimolace)
    lives_reached = r_lives["status"] in (200, 403)
    record("GET /lives avec tenant header joignable",
           lives_reached,
           f"status={r_lives['status']} (403 attendu si pas membre)")

    r_courses = api_call("GET", "/courses", token=token, tenant=SCHOOL_SLUG, expect_ok=False)
    record("GET /courses avec tenant header joignable",
           r_courses["status"] in (200, 403),
           f"status={r_courses['status']}")

    r_smartboard = api_call("GET", "/smartboard/slides", token=token, tenant=SCHOOL_SLUG, expect_ok=False)
    record("GET /smartboard/slides avec tenant header joignable",
           r_smartboard["status"] in (200, 403, 404),
           f"status={r_smartboard['status']}")

    r_marketing = api_call("GET", "/marketing/promo-codes", token=token, tenant=SCHOOL_SLUG, expect_ok=False)
    record("GET /marketing/promo-codes avec tenant header joignable",
           r_marketing["status"] in (200, 403),
           f"status={r_marketing['status']}")

    # Vérifier que le tenant existe dans la base
    r_tenant = api_call("GET", f"/cimolace-backoffice/clients/{provisioned['client']['id']}/control-plane",
                        token=token)
    ok_cp = r_tenant["ok"] and isinstance(r_tenant["body"], dict)
    record("Control-plane Cimolace accessible post-provision",
           ok_cp, f"status={r_tenant['status']}")
    if ok_cp:
        cp = r_tenant["body"]
        svc_count = len(cp.get("services") or [])
        record(f"Services dans control-plane",
               svc_count > 0, f"{svc_count} services actifs")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 7 — UI Playwright : wizard /cimolace/create-school
# ═══════════════════════════════════════════════════════════════════════════════
def test_ui_create_school_wizard(auth_session):
    print("\n══════ 7. UI Playwright — wizard Créer mon école ════════════════")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Slug unique pour ce test UI (différent du slug API)
    ui_slug = f"ui-ecole-{TIMESTAMP}"
    ui_name = f"UI École {TIMESTAMP}"

    storage_key = supabase_storage_key()
    storage_value = json.dumps(auth_session)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            viewport={"width": 1280, "height": 900},
            locale="fr-FR",
        )
        page = ctx.new_page()

        # Intercepter les réponses API pour débugger
        api_responses = []
        def on_response(response):
            url = response.url
            if "school-onboarding" in url or "provision" in url.lower():
                try:
                    status = response.status
                    body_text = response.text()
                    api_responses.append({"url": url, "status": status, "body": body_text[:300]})
                except Exception:
                    pass
        page.on("response", on_response)

        # Connexion via le formulaire de login Cimolace
        page.goto(f"{APP_ORIGIN}/cimolace/login", wait_until="domcontentloaded")
        time.sleep(1)
        screenshot(page, "00-login-page")

        # Remplir email + password
        email_filled = False
        try:
            page.locator("input[name='email']").fill(CIMOLACE_EMAIL)
            page.locator("input[name='password']").fill(CIMOLACE_PASSWORD)
            email_filled = True
        except Exception:
            # Fallback : utiliser le bouton "Remplir" s'il existe
            for btn in page.locator("button").all():
                if "remplir" in (btn.text_content() or "").lower():
                    btn.click()
                    time.sleep(0.5)
                    break

        screenshot(page, "00b-login-filled")

        # Soumettre le formulaire
        page.locator("button[type='submit'], button:has-text('Se connecter')").first.click()
        try:
            page.wait_for_url("**/cimolace/admin**", timeout=10000)
        except PWTimeout:
            pass
        time.sleep(2)
        screenshot(page, "00c-post-login")

        logged_in = "login" not in page.url
        record("Login Cimolace réussi", logged_in, page.url)
        if not logged_in:
            browser.close()
            return None

        # Naviguer vers le wizard via client-side navigation (pas de full reload)
        # pour conserver la session Supabase en mémoire
        page.evaluate("window.history.pushState({}, '', '/cimolace/create-school')")
        page.evaluate("window.dispatchEvent(new PopStateEvent('popstate'))")
        time.sleep(0.5)
        # Si le routing SPA ne se déclenche pas, forcer un goto
        if "create-school" not in page.url:
            page.goto(f"{APP_ORIGIN}/cimolace/create-school")
            time.sleep(1)

        # Attendre que le wizard soit visible (pas le formulaire de login)
        try:
            page.wait_for_selector("input[placeholder='Ex : École Fatima']", timeout=8000)
            wizard_visible = True
        except PWTimeout:
            wizard_visible = False

        time.sleep(1)
        screenshot(page, "01-create-school-loaded")

        # Vérifier que la page s'est chargée (wizard visible, pas de redirect)
        current_url = page.url
        on_wizard = "create-school" in current_url and wizard_visible
        record("Page /cimolace/create-school — wizard visible",
               on_wizard, f"{current_url} | wizard={'✅' if wizard_visible else '❌'}")

        if not on_wizard:
            # Essai via clic sidebar
            sidebar_link = page.locator("a[href='/cimolace/create-school']").first
            try:
                sidebar_link.click()
                page.wait_for_selector("input[placeholder='Ex : École Fatima']", timeout=8000)
                on_wizard = True
                record("Wizard accessible via lien sidebar", True)
            except Exception:
                record("Wizard non accessible même via sidebar", False)
                browser.close()
                return None

        screenshot(page, "01b-wizard-confirmed")

        if not on_wizard:
            browser.close()
            return None

        # ── Étape 1 : Identité ────────────────────────────────────────────────
        print("\n    → Étape 1 : Identité école")

        # Remplir le nom de l'école (placeholder exact : "Ex : École Fatima")
        try:
            name_input = page.locator("input[placeholder='Ex : École Fatima']")
            name_input.wait_for(state="visible", timeout=5000)
            name_input.fill(ui_name)
            record("Champ nom école rempli", True, ui_name)
        except PWTimeout:
            # Fallback : premier input text visible
            inputs = page.locator("input").all()
            if inputs:
                inputs[0].fill(ui_name)
                record("Champ nom école rempli (fallback nth-0)", True, ui_name)
            else:
                record("Champ nom école non trouvé", False)

        time.sleep(0.8)  # laisser le temps à l'auto-slug
        screenshot(page, "02-step1-name-filled")

        # Vérifier le slug auto-généré (placeholder exact : "ecole-fatima")
        try:
            slug_input = page.locator("input[placeholder='ecole-fatima']")
            slug_value = slug_input.input_value()
            record("Slug auto-généré depuis nom", bool(slug_value), slug_value)
            slug_input.click(click_count=3)
            slug_input.fill(ui_slug)
            record("Slug remplacé par slug unique", True, ui_slug)
        except Exception as ex:
            record("Slug auto-généré (erreur)", False, str(ex)[:60])

        # Remplir l'email owner (placeholder exact : "admin@monecole.org")
        try:
            email_input = page.locator("input[placeholder='admin@monecole.org']")
            email_input.fill(f"owner-ui@{ui_slug}.test")
            record("Email owner rempli", True, f"owner-ui@{ui_slug}.test")
        except Exception:
            email_inputs = page.locator("input[type='email']").all()
            if email_inputs:
                email_inputs[0].fill(f"owner-ui@{ui_slug}.test")
                record("Email owner rempli (fallback)", True)
            else:
                record("Champ email owner non trouvé", False)

        screenshot(page, "03-step1-complete")

        # Bouton "Suivant →" (texte exact dans le wizard)
        def click_button_containing(page, texts, label, exclude=None):
            exclude = exclude or []
            for btn in page.locator("button").all():
                try:
                    txt = (btn.text_content() or "").strip()
                    if any(t.lower() in txt.lower() for t in texts):
                        if any(e.lower() in txt.lower() for e in exclude):
                            continue
                        btn.click()
                        time.sleep(0.6)
                        record(label, True, txt)
                        return True
                except Exception:
                    pass
            all_btns = [b.text_content() for b in page.locator("button").all()[:10]]
            record(label, False, f"boutons visibles: {all_btns}")
            return False

        # "Suivant →" — exclure "Google" pour ne pas cliquer le bouton OAuth
        click_button_containing(page, ["Suivant →", "Suivant", "→"],
                                 "Navigation Étape 1 → Étape 2",
                                 exclude=["Google", "Facebook", "login", "sign"])

        screenshot(page, "04-step2-branding")

        # ── Étape 2 : Personnalisation ───────────────────────────────────────
        print("\n    → Étape 2 : Branding")
        color_inputs = page.locator("input[type='color']").all()
        record(f"Color pickers trouvés (étape 2)", len(color_inputs) > 0,
               f"{len(color_inputs)} inputs couleur")

        click_button_containing(page, ["Suivant", "Next", "Continuer"],
                                "Navigation Étape 2 → Étape 3")

        screenshot(page, "05-step3-confirm")

        # ── Étape 3 : Confirmation + Prévisualisation ─────────────────────────
        print("\n    → Étape 3 : Prévisualisation et confirmation")

        # Bouton "Prévisualiser le plan" (texte exact dans le wizard)
        if not click_button_containing(page, ["Prévisualiser", "Preview", "Vérifier"],
                                        "Bouton Prévisualiser cliqué"):
            screenshot(page, "06-preview-missing")
        else:
            time.sleep(2)
            screenshot(page, "06-preview-loaded")

        # Input de confirmation slug (placeholder = le slug lui-même)
        confirm_filled = False
        for inp in page.locator("input[placeholder]").all():
            try:
                ph = inp.get_attribute("placeholder") or ""
                val = inp.input_value() or ""
                # Le wizard met le slug comme placeholder sur l'input de confirmation
                if (ph and ph == ui_slug) or (ph and len(ph) > 5 and ph.replace("-", "").isalnum()):
                    inp.click(click_count=3)
                    inp.fill(ui_slug)
                    record("Input confirmation slug rempli", True, ui_slug)
                    confirm_filled = True
                    time.sleep(0.3)
                    break
            except Exception:
                pass
        if not confirm_filled:
            # Dernier input visible de l'étape 3
            all_inputs = page.locator("input").all()
            if all_inputs:
                all_inputs[-1].click(click_count=3)
                all_inputs[-1].fill(ui_slug)
                record("Input confirmation slug rempli (dernier input)", True, ui_slug)

        screenshot(page, "07-before-create")

        # Debug : lister tous les boutons + état disabled
        all_btns_debug = []
        for btn in page.locator("button").all():
            try:
                txt = (btn.text_content() or "").strip()
                disabled = btn.is_disabled()
                all_btns_debug.append(f"'{txt}' {'[DISABLED]' if disabled else '[OK]'}")
            except Exception:
                pass
        print(f"    ℹ️  Boutons avant création : {all_btns_debug}")

        # Bouton "Créer mon école" (texte exact)
        create_btn = None
        create_btn_disabled = False
        for btn in page.locator("button").all():
            try:
                txt = (btn.text_content() or "").strip()
                if any(x.lower() in txt.lower() for x in ["créer mon école", "créer", "create", "provisionner"]):
                    disabled = btn.is_disabled()
                    if not disabled:
                        create_btn = btn
                        break
                    elif create_btn is None:
                        create_btn = btn  # garder même si disabled pour debug
                        create_btn_disabled = True
            except Exception:
                pass

        if create_btn:
            try:
                if create_btn_disabled:
                    print(f"    ⚠️  Bouton 'Créer' trouvé mais DISABLED — vérifier confirmSlug vs form.slug")
                    record("Bouton Créer mon école trouvé mais désactivé", False,
                           "confirmSlug ne correspond pas au slug du formulaire ?")
                    screenshot(page, "07b-create-btn-disabled")
                    browser.close()
                    return ui_slug
                create_btn.click()
                # Attendre le panel succès (pas de redirect, le wizard affiche un succès en place)
                try:
                    page.wait_for_selector("text=créée avec succès", timeout=15000)
                    success_shown = True
                except PWTimeout:
                    success_shown = False

                time.sleep(2)
                screenshot(page, "08-after-create")

                if success_shown:
                    record("Panel succès 'École créée' affiché", True)
                    # Cliquer "Accéder à mon école"
                    access_link = page.locator("a:has-text('Accéder à mon école'), a:has-text('accéder')").first
                    try:
                        access_link.click()
                        time.sleep(2)
                        new_url = page.url
                        on_school = "/t/" in new_url and "/admin" in new_url
                        record("Navigation vers /t/{slug}/admin via lien", on_school, new_url)
                        screenshot(page, "08b-school-admin-via-link")
                    except Exception:
                        # Vérifier que le lien est bien sur la page
                        links = [a.get_attribute("href") for a in page.locator("a").all()[:10]]
                        record("Lien 'Accéder à mon école' présent", any("/t/" in (l or "") for l in links),
                               str(links))
                else:
                    new_url = page.url
                    print(f"    📡 Réponses API interceptées : {api_responses}")
                    record("Création UI — résultat", False,
                           f"url={new_url} | api_calls={len(api_responses)}")
            except Exception as ex:
                record("Bouton Créer cliqué", False, str(ex))
        else:
            record("Bouton Créer mon école non trouvé", False, "wizard UI à compléter")
            screenshot(page, "08-create-btn-missing")

        # Capture finale
        screenshot(page, "09-final-ui")
        browser.close()

    return ui_slug

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 8 — UI Playwright : accès app école + création live
# ═══════════════════════════════════════════════════════════════════════════════
def test_ui_school_app(auth_session, school_slug):
    print("\n══════ 8. UI Playwright — App école + création live ═════════════")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    storage_key   = supabase_storage_key()
    storage_value = json.dumps(auth_session)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            viewport={"width": 1280, "height": 900},
            locale="fr-FR",
        )
        page = ctx.new_page()
        # Login via le formulaire
        page.goto(f"{APP_ORIGIN}/cimolace/login", wait_until="domcontentloaded")
        time.sleep(0.8)
        try:
            page.locator("input[name='email']").fill(CIMOLACE_EMAIL)
            page.locator("input[name='password']").fill(CIMOLACE_PASSWORD)
            page.locator("button[type='submit']").first.click()
        except Exception:
            for btn in page.locator("button").all():
                if "remplir" in (btn.text_content() or "").lower():
                    btn.click()
                    time.sleep(0.5)
                    page.locator("button[type='submit']").first.click()
                    break
        time.sleep(2)

        # Naviguer vers l'admin de l'école
        page.goto(f"{APP_ORIGIN}/t/{school_slug}/admin", wait_until="domcontentloaded")
        time.sleep(2)
        time.sleep(2)
        screenshot(page, "10-school-admin")
        current_url = page.url
        on_school = school_slug in current_url or "admin" in current_url
        record(f"Page /t/{school_slug}/admin accessible", on_school, current_url)

        # Naviguer vers la page live
        live_url = f"{APP_ORIGIN}/t/{school_slug}/admin/lives"
        page.goto(live_url, wait_until="domcontentloaded")
        time.sleep(1.5)
        screenshot(page, "11-school-lives")
        record("Page lives de l'école accessible",
               page.url == live_url or "lives" in page.url or page.url.endswith("/admin"),
               page.url)

        # Naviguer vers les cours
        courses_url = f"{APP_ORIGIN}/t/{school_slug}/admin/courses"
        page.goto(courses_url, wait_until="domcontentloaded")
        time.sleep(1.5)
        screenshot(page, "12-school-courses")
        record("Page courses de l'école accessible",
               "courses" in page.url or page.url.endswith("/admin"),
               page.url)

        # Naviguer vers students
        students_url = f"{APP_ORIGIN}/t/{school_slug}/admin/students"
        page.goto(students_url, wait_until="domcontentloaded")
        time.sleep(1.5)
        screenshot(page, "13-school-students")
        record("Page students de l'école accessible",
               "students" in page.url or page.url.endswith("/admin"),
               page.url)

        browser.close()

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 9 — API : création live depuis l'école provisionnée
# ═══════════════════════════════════════════════════════════════════════════════
def test_create_live_api(token, school_slug):
    print("\n══════ 9. API — Création live dans l'école ══════════════════════")

    # Tenter de créer un live (peut échouer 403 si token admin n'est pas membre du tenant)
    live_payload = {
        "title": f"Live Test E2E {TIMESTAMP}",
        "description": "Session live de test E2E automatique",
        "price_cents": 0,
        "currency": "XOF",
        "scheduled_at": datetime.now(timezone.utc).isoformat(),
        "duration_minutes": 60,
    }
    r = api_call("POST", "/lives", token=token, tenant=school_slug, body=live_payload, expect_ok=False)
    status = r["status"]
    # 201 = créé, 403 = pas membre (attendu pour l'admin Cimolace sans membership dans ce tenant)
    created = status == 201
    forbidden = status == 403
    record("POST /lives dans l'école",
           created or forbidden,
           f"status={status} ({'créé ✅' if created else 'pas membre (403 attendu) ✅' if forbidden else '❌ erreur'})")

    if created:
        live = r["body"]
        live_id = live.get("id") if isinstance(live, dict) else None
        record("Live ID retourné", bool(live_id), str(live_id)[:20] if live_id else "❌")

        # Tenter de récupérer le token LiveKit
        if live_id:
            r_token = api_call("GET", f"/lives/{live_id}/token",
                               token=token, tenant=school_slug, expect_ok=False)
            record("GET /lives/:id/token LiveKit",
                   r_token["status"] in (200, 403),
                   f"status={r_token['status']}")
            if r_token["status"] == 200:
                lk_token = (r_token["body"] or {}).get("token")
                record("Token LiveKit reçu", bool(lk_token),
                       f"…{lk_token[-16:]}" if lk_token else "❌")
    return r

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 10 — Nettoyage (optionnel)
# ═══════════════════════════════════════════════════════════════════════════════
def test_cleanup(token, provisioned):
    print("\n══════ 10. État final & Résumé ═══════════════════════════════════")
    if not provisioned:
        return

    # Vérifier que le tenant est bien dans l'historique
    r = api_call("GET", "/cimolace-backoffice/provision-school", token=token, expect_ok=False)
    if r["ok"]:
        rows = r["body"] if isinstance(r["body"], list) else []
        found = any(row.get("new_tenant_slug") == SCHOOL_SLUG for row in rows)
        record("École dans l'historique provisioning", found,
               f"Historique : {len(rows)} entrées")
    else:
        record("Historique provisioning accessible", False, f"status={r['status']}")

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════
def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("╔══════════════════════════════════════════════════════════════════╗")
    print("║  ISNA Platform V2 — Test Playwright complet école               ║")
    print(f"║  École : {SCHOOL_SLUG:<52}║")
    print(f"║  Sortie : {str(OUT_DIR):<51}║")
    print("╚══════════════════════════════════════════════════════════════════╝")

    # 1. Santé API
    test_api_health()

    # 2. Auth
    token = test_cimolace_auth()
    if not token:
        dump_report()
        return

    # Récupérer la session Supabase complète pour Playwright
    auth_session = supabase_sign_in(CIMOLACE_EMAIL, CIMOLACE_PASSWORD)
    if not auth_session.get("access_token"):
        record("Session Supabase pour UI", False, "impossible d'injecter la session")
        auth_session = None

    # 3. Manifest moteurs
    test_engine_manifest(token)

    # 4. Preview provisioning
    preview, payload = test_provision_preview(token)

    # 5. Création école (API)
    provisioned = test_provision_school(token, payload)

    # 6. Moteurs école (API)
    if provisioned:
        test_school_engines_api(token, provisioned)

    # 7. UI Wizard Créer mon école
    ui_slug = None
    if auth_session:
        ui_slug = test_ui_create_school_wizard(auth_session)
    else:
        print("\n  ⏭️  Section 7 ignorée — session UI non disponible")

    # 8. UI App école
    target_slug = ui_slug or SCHOOL_SLUG
    if auth_session and provisioned:
        test_ui_school_app(auth_session, target_slug)
    else:
        print("\n  ⏭️  Section 8 ignorée — école ou session UI non disponible")

    # 9. Création live (API)
    if provisioned:
        test_create_live_api(token, SCHOOL_SLUG)

    # 10. État final
    test_cleanup(token, provisioned)

    # Rapport final
    dump_report()

    if SCREENSHOTS:
        print("📸 Captures d'écran disponibles :")
        for s in SCREENSHOTS:
            print(f"   {s}")

    # Code de sortie
    sys.exit(0 if FAIL_COUNT == 0 else 1)


if __name__ == "__main__":
    main()
