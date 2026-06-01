#!/usr/bin/env bash
# ============================================================
# MedOS E2E Test Script — Phase 1A
# Usage:
#   BASE_URL=http://localhost:4002 \
#   TENANT_SLUG=my-tenant \
#   PRAC_TOKEN=<jwt> PAT_TOKEN=<jwt> REC_TOKEN=<jwt> \
#   ./scripts/medos_e2e_test.sh
#
# Generate fresh tokens with: node scripts/gen-jwt.mjs
# ============================================================
set -euo pipefail

BASE="${BASE_URL:-http://localhost:4002}"
SLUG="${TENANT_SLUG:-medos-e2e-local}"
RESULTS="/tmp/medos_results.txt"
PASS=0
FAIL=0

# Tokens
PRAC="${PRAC_TOKEN:-}"
PAT="${PAT_TOKEN:-}"
REC="${REC_TOKEN:-}"

# ── Helpers ──────────────────────────────────────────────────
ok()   { echo "  ✅  $1"; ((PASS++)); }
nok()  { echo "  ❌  $1 — $2"; ((FAIL++)); }
h()    { echo; echo "── $1 ──────────────────────────────────────"; }
chk() {
  local label="$1" expected="$2" actual="$3" body="${4:-}"
  if [[ "$actual" == "$expected" ]]; then
    ok "$label (HTTP $actual)"
  else
    nok "$label" "expected HTTP $expected, got $actual  $body"
  fi
}
get_id() {
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id') or d.get('id',''))" 2>/dev/null || echo ""
}

# ── Preflight ────────────────────────────────────────────────
echo "MedOS E2E Tests — $(date)" | tee "$RESULTS"
echo "BASE=$BASE  SLUG=$SLUG" | tee -a "$RESULTS"

if [[ -z "$PRAC" || -z "$PAT" ]]; then
  echo
  echo "⚠️  PRAC_TOKEN and PAT_TOKEN are required."
  echo "   Generate them: node scripts/gen-jwt.mjs"
  echo "   Then re-run:   PRAC_TOKEN=... PAT_TOKEN=... ./scripts/medos_e2e_test.sh"
  exit 0
fi

# ── 1. Health check ──────────────────────────────────────────
h "1. Health"
S=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/health")
chk "GET /health" "200" "$S"

# ── 2. Create patient ────────────────────────────────────────
h "2. Create patient (practitioner)"
BODY=$(curl -s -X POST "$BASE/med/patients" \
  -H "Authorization: Bearer $PRAC" \
  -H "X-Tenant-Slug: $SLUG" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"E2E","last_name":"Patient","date_of_birth":"1990-01-01","gender":"male"}')
S=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/med/patients" \
  -H "Authorization: Bearer $PRAC" \
  -H "X-Tenant-Slug: $SLUG" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"E2E","last_name":"Patient","date_of_birth":"1990-01-01","gender":"male"}')
chk "POST /med/patients" "201" "$S" ""
PATIENT_ID=$(echo "$BODY" | get_id)
echo "   patient_id=${PATIENT_ID:0:8}..."

# ── 3. List patients ─────────────────────────────────────────
h "3. List patients"
S=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/med/patients" \
  -H "Authorization: Bearer $PRAC" \
  -H "X-Tenant-Slug: $SLUG")
chk "GET /med/patients" "200" "$S"

# ── 4. Create charting note ──────────────────────────────────
h "4. Create consultation note"
if [[ -n "$PATIENT_ID" ]]; then
  BODY=$(curl -s -X POST "$BASE/med/notes" \
    -H "Authorization: Bearer $PRAC" \
    -H "X-Tenant-Slug: $SLUG" \
    -H "Content-Type: application/json" \
    -d "{\"patient_id\":\"$PATIENT_ID\",\"subjective\":\"Patient complains of headache\",\"objective\":\"BP 120/80\",\"assessment\":\"Tension headache\",\"plan\":\"Paracetamol 500mg\"}")
  S=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/med/notes" \
    -H "Authorization: Bearer $PRAC" \
    -H "X-Tenant-Slug: $SLUG" \
    -H "Content-Type: application/json" \
    -d "{\"patient_id\":\"$PATIENT_ID\",\"subjective\":\"Headache\",\"objective\":\"BP normal\",\"assessment\":\"Tension\",\"plan\":\"Rest\"}")
  chk "POST /med/notes" "201" "$S"
  NOTE_ID=$(echo "$BODY" | get_id)
  echo "   note_id=${NOTE_ID:0:8}..."
else
  nok "POST /med/notes" "skipped — no patient_id"
  NOTE_ID=""
fi

# ── 5. Sign note ─────────────────────────────────────────────
h "5. Sign note (practitioner)"
if [[ -n "${NOTE_ID:-}" ]]; then
  S=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/med/notes/$NOTE_ID/sign" \
    -H "Authorization: Bearer $PRAC" \
    -H "X-Tenant-Slug: $SLUG")
  chk "PATCH /med/notes/:id/sign" "200" "$S"
else
  nok "PATCH /med/notes/:id/sign" "skipped"
fi

# ── 6. Share note with patient ───────────────────────────────
h "6. Share note with patient"
if [[ -n "${NOTE_ID:-}" ]]; then
  S=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/med/notes/$NOTE_ID/share" \
    -H "Authorization: Bearer $PRAC" \
    -H "X-Tenant-Slug: $SLUG")
  chk "PATCH /med/notes/:id/share" "200" "$S"
else
  nok "PATCH /med/notes/:id/share" "skipped"
fi

# ── 7. Patient reads own notes ───────────────────────────────
h "7. Patient reads own notes"
S=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/med/me/notes" \
  -H "Authorization: Bearer $PAT" \
  -H "X-Tenant-Slug: $SLUG")
chk "GET /med/me/notes" "200" "$S"

# ── 8. Patient marks note as read ────────────────────────────
h "8. Patient marks note read"
if [[ -n "${NOTE_ID:-}" ]]; then
  S=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/med/me/notes/$NOTE_ID/read" \
    -H "Authorization: Bearer $PAT" \
    -H "X-Tenant-Slug: $SLUG")
  chk "POST /med/me/notes/:id/read" "200" "$S"
else
  nok "POST /med/me/notes/:id/read" "skipped"
fi

# ── 9. Create health entry ───────────────────────────────────
h "9. Create health entry"
if [[ -n "${PATIENT_ID:-}" ]]; then
  S=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/med/health-entries" \
    -H "Authorization: Bearer $PRAC" \
    -H "X-Tenant-Slug: $SLUG" \
    -H "Content-Type: application/json" \
    -d "{\"patient_id\":\"$PATIENT_ID\",\"entry_type\":\"vital\",\"data\":{\"systolic\":120,\"diastolic\":80,\"heart_rate\":72}}")
  chk "POST /med/health-entries" "201" "$S"
else
  nok "POST /med/health-entries" "skipped — no patient_id"
fi

# ── 10. List health entries ──────────────────────────────────
h "10. List health entries (patient)"
if [[ -n "${PATIENT_ID:-}" ]]; then
  S=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/med/health-entries?patient_id=$PATIENT_ID" \
    -H "Authorization: Bearer $PRAC" \
    -H "X-Tenant-Slug: $SLUG")
  chk "GET /med/health-entries" "200" "$S"
fi

# ── 11. RBAC guard: receptionist cannot sign ─────────────────
h "11. RBAC: receptionist cannot sign notes (expects 403)"
if [[ -n "$REC" && -n "${NOTE_ID:-}" ]]; then
  S=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/med/notes/$NOTE_ID/sign" \
    -H "Authorization: Bearer $REC" \
    -H "X-Tenant-Slug: $SLUG")
  chk "PATCH /med/notes/:id/sign (receptionist)" "403" "$S"
else
  echo "   ⏭  skipped — set REC_TOKEN to test RBAC"
fi

# ── 12. RBAC guard: patient cannot create note ───────────────
h "12. RBAC: patient cannot create notes (expects 403)"
if [[ -n "${PATIENT_ID:-}" ]]; then
  S=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/med/notes" \
    -H "Authorization: Bearer $PAT" \
    -H "X-Tenant-Slug: $SLUG" \
    -H "Content-Type: application/json" \
    -d "{\"patient_id\":\"$PATIENT_ID\",\"subjective\":\"test\"}")
  chk "POST /med/notes (patient)" "403" "$S"
fi

# ── Summary ──────────────────────────────────────────────────
echo
echo "════════════════════════════════════════════════════"
printf "  MedOS E2E — %d passed, %d failed\n" "$PASS" "$FAIL"
echo "════════════════════════════════════════════════════"
printf "Passed: %d  Failed: %d\n" "$PASS" "$FAIL" >> "$RESULTS"

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
