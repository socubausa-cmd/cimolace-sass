#!/usr/bin/env python3
"""MedOS Phase 1A UI Validation — API Scenario Tests."""
import urllib.request, urllib.error, json, sys

API = "http://localhost:4001"
TOKEN = "eyJhbGciOiJFUzI1NiIsImtpZCI6ImE5ZTczODgwLTE1ZDYtNDczZi1iZWFkLWNhM2FhMmFlNGVkMCIsInR5cCI6IkpXVCJ9.eyJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc3ODQ2MDQxMX1dLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdLCJzZXNzaW9uX3ZlcnNpb24iOjEsInRlbmFudF9pZCI6ImFmNDNlZjMzLWM3NmMtNDY4Yy1iYjAzLWVmYTVmNjM1MzdlNSIsInRlbmFudF9yb2xlIjoicHJhY3RpdGlvbmVyIn0sImF1ZCI6ImF1dGhlbnRpY2F0ZWQiLCJlbWFpbCI6Im1lZC1wcmFjdGl0aW9uZXItMTc3ODQzMjIyNUBlMmUudGVzdCIsImV4cCI6MTc3ODQ2NDAxMSwiaWF0IjoxNzc4NDYwNDExLCJpc19hbm9ueW1vdXMiOmZhbHNlLCJpc3MiOiJodHRwczovL2Z3ZnVweHZtd3R4YnRiamRlcXZ1LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJwaG9uZSI6IiIsInJvbGUiOiJhdXRoZW50aWNhdGVkIiwic2Vzc2lvbl9pZCI6ImNkMTdmMzcxLWNiNjItNDAxZC05Zjc0LTcxMmYzZjk4MTg4ZCIsInN1YiI6IjRiMzQzYTJhLTg0ZmUtNDNmOS04ZDBiLWM3ZDQwZTAxNzI3NiIsInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWV9fQ.3pzahAUnNE-oOtoh2pn0qEHK64YCCoOW9MaG5FlIbUyAUv2YWUk7O1z91vBC_WFruZv9HijBbbYhZEzjLigBLA"
TENANT = "medos-e2e-1778432225"

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "X-Tenant-Slug": TENANT,
    "Content-Type": "application/json",
}

results = []
patient_id = None
note_id = None

def call(method, path, body=None, desc=""):
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode()
            js = json.loads(raw)
            status = resp.status
            r = {"desc": desc, "method": method, "path": path, "status": status, "ok": status < 400, "body": js}
            results.append(r)
            return js
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            js = json.loads(raw)
        except:
            js = {"raw": raw}
        r = {"desc": desc, "method": method, "path": path, "status": e.code, "ok": False, "body": js}
        results.append(r)
        return js
    except Exception as e:
        r = {"desc": desc, "method": method, "path": path, "status": 0, "ok": False, "error": str(e)}
        results.append(r)
        return {"error": str(e)}

# 1. List patients
print("1. GET /med/patients...")
res = call("GET", "/med/patients", desc="List patients (practitioner)")
patients = res.get("data", [])
count = len(patients)
print(f"   -> {res.get('status','?')} - {len(patients)} patients")
for p in patients:
    print(f"      {p['first_name']} {p['last_name']} ({p['id'][:8]}...)")
    if not patient_id:
        patient_id = p['id']

# 2. Patient detail
if patient_id:
    print(f"\n2. GET /med/patients/{patient_id}...")
    res = call("GET", f"/med/patients/{patient_id}", desc="Patient detail")
    p = res.get("data", {})
    print(f"   -> {res.get('status','?')} - {p.get('first_name','?')} {p.get('last_name','?')}")

# 3. Create a new test patient
print("\n3. POST /med/patients (create)...")
new_patient = {
    "patient_user_id": "00000000-0000-0000-0000-00000000e2e1",
    "first_name": "UI_Test",
    "last_name": "ValidE2E",
    "date_of_birth": "1990-01-01",
    "gender": "other",
}
res = call("POST", "/med/patients", body=new_patient, desc="Create patient")
if res.get("data"):
    new_pid = res["data"]["id"]
    print(f"   -> 201 - Created: {new_pid[:8]}...")
else:
    print(f"   -> {res.get('status','?')} - {res.get('error',{}).get('message','?')}")
    # Try 409 — already exists?
    new_pid = None

# 4. Create note
if patient_id:
    print(f"\n4. POST /med/patients/{patient_id}/notes...")
    note_body = {
        "subjective": "Céphalées légères",
        "objective": "Tension normale",
        "assessment": "Observation",
        "plan": "Hydratation et repos",
    }
    res = call("POST", f"/med/patients/{patient_id}/notes", body=note_body, desc="Create SOAP note")
    note_data = res.get("data", {})
    if note_data:
        note_id = note_data["id"]
        print(f"   -> 201 - Note created: {note_id[:8]}...")
    else:
        print(f"   -> {res.get('status','?')}")

# 5. Sign note
if note_id:
    print(f"\n5. POST /med/notes/{note_id}/sign...")
    res = call("POST", f"/med/notes/{note_id}/sign", desc="Sign note")
    print(f"   -> {res.get('status','?')} - signed={res.get('data',{}).get('is_signed','?')}")

# 6. Double sign (should 400)
if note_id:
    print(f"\n6. POST /med/notes/{note_id}/sign (2nd time)...")
    res = call("POST", f"/med/notes/{note_id}/sign", desc="Double sign (expect 400)")
    ok = res.get("status") == 400
    print(f"   -> {res.get('status','?')} - {'EXPECTED 400' if ok else 'UNEXPECTED'}")

# 7. Share note
if note_id:
    print(f"\n7. POST /med/notes/{note_id}/share...")
    res = call("POST", f"/med/notes/{note_id}/share", body={"is_shared": True}, desc="Share note")
    print(f"   -> {res.get('status','?')} - shared={res.get('data',{}).get('is_shared_with_patient','?')}")

# 8. Verify NO /med/forms or /med/health
print("\n8. Checking /med/forms and /med/health...")
for path in ["/med/forms", "/med/health", "/med/forms/health"]:
    res = call("GET", path, desc=f"Check {path} (expect 404)")
    status = res.get("status", 0)
    print(f"   -> {path} = {status} {'OK (not found)' if status == 404 else 'UNEXPECTED'}")

# 9. Vite frontend
print("\n9. Vite frontend...")
try:
    req = urllib.request.Request("http://localhost:5174/", headers={"Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=5) as resp:
        html = resp.read().decode()
        has_root = '<div id="root">' in html
        print(f"   -> {resp.status} - root div found: {has_root}")
except Exception as e:
    print(f"   -> ERROR: {e}")

# Summary
print("\n" + "="*60)
print("SUMMARY")
print("="*60)
passed = sum(1 for r in results if r["ok"])
failed = sum(1 for r in results if not r["ok"])
print(f"Total: {len(results)} | Passed: {passed} | Failed: {failed}")
for r in results:
    icon = "✅" if r["ok"] else "❌"
    print(f"  {icon} [{r['status']}] {r['method']} {r['path']} — {r['desc']}")
