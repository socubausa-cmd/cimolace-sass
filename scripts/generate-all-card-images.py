#!/usr/bin/env python3
"""Génère une illustration IA (Mistral via edge generate-visual-image) pour chaque
carte (nœud) du mindmap d'un contenu, écrit illustrationUrl sur les nœuds, et met à
jour formation_day_contents.data->mindmap en base. Idempotent (saute les nœuds déjà
illustrés). Usage: python3 generate-all-card-images.py <contentId>
"""
import json, os, re, subprocess, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

def read_env(path, key):
    try:
        with open(path) as f:
            for line in f:
                m = re.match(r'^%s=(.*)$' % re.escape(key), line.strip())
                if m:
                    return m.group(1).strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return None

SUPA_URL = read_env(os.path.join(ROOT, 'apps/app/.env'), 'VITE_SUPABASE_URL')
ANON = read_env(os.path.join(ROOT, 'apps/app/.env'), 'VITE_SUPABASE_ANON_KEY')
DBURL = read_env(os.path.join(ROOT, '.env.production'), 'DATABASE_URL')
CONTENT_ID = sys.argv[1] if len(sys.argv) > 1 else 'd5d5d5d5-0000-4000-8000-000000000005'

if not (SUPA_URL and ANON and DBURL):
    print('ENV manquant'); sys.exit(1)

def psql(sql, want_output=True):
    args = ['psql', DBURL, '-At', '-c', sql]
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip())
    return r.stdout

mm_text = psql("select (data->'mindmap')::text from formation_day_contents where id='%s'" % CONTENT_ID).strip()
mindmap = json.loads(mm_text)

cards = []
def walk(node):
    for c in (node.get('children') or []):
        if c.get('id') and (c.get('label') or c.get('summary')):
            cards.append(c)
        walk(c)
walk(mindmap)

todo = [c for c in cards if not c.get('illustrationUrl')]
print('Cartes totales=%d, à générer=%d' % (len(cards), len(todo)), flush=True)

def gen_image_once(card):
    label = (card.get('label') or '').strip()
    summary = (card.get('summary') or '').strip()
    prompt = ('Illustration pédagogique claire et explicite pour le concept '
              '« %s ». %s' % (label, summary)).strip()
    body = json.dumps({'prompt': prompt, 'provider': 'auto'}).encode()
    req = urllib.request.Request(SUPA_URL + '/functions/v1/generate-visual-image', data=body,
        headers={'Content-Type': 'application/json', 'apikey': ANON,
                 'Authorization': 'Bearer ' + ANON})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode())
    return data.get('imageUrl'), data.get('error')

def gen_image(card):
    # Retry (Mistral rate-limite en rafale) : 3 tentatives, backoff croissant.
    last_err = None
    for attempt in range(3):
        try:
            url, err = gen_image_once(card)
            if url:
                return url
            last_err = err or 'vide'
        except Exception as e:
            last_err = str(e)[:120]
        time.sleep(3 + attempt * 4)
    raise RuntimeError(last_err or 'échec')

ok = 0
for i, card in enumerate(todo, 1):
    lbl = (card.get('label') or '')[:40]
    if i > 1:
        time.sleep(2)  # espace les appels → évite le rate-limit Mistral
    try:
        url = gen_image(card)
        if url:
            card['illustrationUrl'] = url
            ok += 1
            print('[%d/%d] OK  %s' % (i, len(todo), lbl), flush=True)
        else:
            print('[%d/%d] vide %s' % (i, len(todo), lbl), flush=True)
    except Exception as e:
        print('[%d/%d] ECHEC %s : %s' % (i, len(todo), lbl, str(e)[:120]), flush=True)

out_path = '/tmp/mm_%s.json' % CONTENT_ID[:8]
with open(out_path, 'w') as f:
    json.dump(mindmap, f, ensure_ascii=False)

upd = subprocess.run(['psql', DBURL], input=(
    "\\set mm `cat %s`\n"
    "update formation_day_contents set data = jsonb_set(data,'{mindmap}', :'mm'::jsonb), updated_at = now() where id='%s';\n"
    % (out_path, CONTENT_ID)), capture_output=True, text=True)
if upd.returncode != 0:
    print('UPDATE ECHEC:', upd.stderr.strip()); sys.exit(1)
print('TERMINE: %d/%d images générées + base mise à jour (%s)' % (ok, len(todo), upd.stdout.strip()), flush=True)
