#!/usr/bin/env python3
"""Pour chaque carte (nœud) du mindmap d'un contenu :
  1) génère le contenu de slide riche (edge generate-slide-content, prompt agent) → node.slideContent
  2) régénère l'image au NOUVEAU style via slide.imagePrompt (edge generate-visual-image) → node.illustrationUrl
puis met à jour formation_day_contents.data->mindmap en base.
Idempotent : saute les nœuds qui ont déjà un slideContent (sauf --force).
Usage: python3 generate-rich-slides.py <contentId> [--force]
"""
import json, os, re, subprocess, sys, time, urllib.request

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
args = [a for a in sys.argv[1:] if not a.startswith('--')]
CONTENT_ID = args[0] if args else 'd5d5d5d5-0000-4000-8000-000000000005'
FORCE = '--force' in sys.argv
COURSE_TITLE = 'La Prorascience'

if not (SUPA_URL and ANON and DBURL):
    print('ENV manquant'); sys.exit(1)

def psql_get(sql):
    r = subprocess.run(['psql', DBURL, '-At', '-c', sql], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip())
    return r.stdout

def post(fn, payload, timeout=120):
    req = urllib.request.Request(SUPA_URL + '/functions/v1/' + fn,
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json', 'apikey': ANON, 'Authorization': 'Bearer ' + ANON})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())

def retry(fn, *a, **k):
    last = None
    for attempt in range(3):
        try:
            return fn(*a, **k)
        except Exception as e:
            last = str(e)[:140]
            time.sleep(4 + attempt * 5)
    raise RuntimeError(last or 'échec')

mm_text = psql_get("select (data->'mindmap')::text from formation_day_contents where id='%s'" % CONTENT_ID).strip()
mindmap = json.loads(mm_text)

cards = []
# Inclut la racine si c'est elle-même une carte (label/summary) — c'est la Carte 1.
if mindmap.get('label') or mindmap.get('summary'):
    cards.append(mindmap)
def walk(node):
    for c in (node.get('children') or []):
        if c.get('id') and (c.get('label') or c.get('summary')):
            cards.append(c)
        walk(c)
walk(mindmap)

todo = [c for c in cards if FORCE or not c.get('slideContent')]
print('Cartes=%d, à traiter=%d (force=%s)' % (len(cards), len(todo), FORCE), flush=True)

def child_labels(node):
    return [str((c.get('label') or c.get('title') or '')).strip()
            for c in (node.get('children') or []) if (c.get('label') or c.get('title'))][:4]

def gen_slide(card):
    payload = {'card': {'label': card.get('label', ''), 'summary': card.get('summary', ''),
                        'childLabels': child_labels(card), 'time': card.get('time', '')},
               'courseTitle': COURSE_TITLE}
    data = post('generate-slide-content', payload, timeout=90)
    if not data.get('slide'):
        raise RuntimeError(data.get('error') or 'pas de slide')
    return data['slide']

def gen_image(prompt):
    data = post('generate-visual-image', {'prompt': prompt, 'provider': 'auto'}, timeout=120)
    return data.get('imageUrl')

ok_slide = ok_img = 0
for i, card in enumerate(todo, 1):
    lbl = (card.get('label') or '')[:38]
    if i > 1:
        time.sleep(2)
    try:
        slide = retry(gen_slide, card)
        card['slideContent'] = slide
        ok_slide += 1
        prompt = slide.get('imagePrompt') or ('Schéma pédagogique clair du concept « %s »' % card.get('label', ''))
        try:
            url = retry(gen_image, prompt)
            if url:
                card['illustrationUrl'] = url
                ok_img += 1
            print('[%d/%d] OK slide + %s  %s' % (i, len(todo), 'img' if url else 'sansimg', lbl), flush=True)
        except Exception as e:
            print('[%d/%d] OK slide, IMG ECHEC %s : %s' % (i, len(todo), lbl, str(e)[:80]), flush=True)
    except Exception as e:
        print('[%d/%d] SLIDE ECHEC %s : %s' % (i, len(todo), lbl, str(e)[:100]), flush=True)

out_path = '/tmp/mm_rich_%s.json' % CONTENT_ID[:8]
with open(out_path, 'w') as f:
    json.dump(mindmap, f, ensure_ascii=False)

upd = subprocess.run(['psql', DBURL], input=(
    "\\set mm `cat %s`\n"
    "update formation_day_contents set data = jsonb_set(data,'{mindmap}', :'mm'::jsonb), updated_at = now() where id='%s';\n"
    % (out_path, CONTENT_ID)), capture_output=True, text=True)
if upd.returncode != 0:
    print('UPDATE ECHEC:', upd.stderr.strip()); sys.exit(1)
print('TERMINE: %d slides + %d images / %d cartes — base mise à jour (%s)' % (ok_slide, ok_img, len(todo), upd.stdout.strip()), flush=True)
