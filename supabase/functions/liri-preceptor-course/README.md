# `liri-preceptor-course` — Edge « croquis tracé-main » du Précepteur

Génère **UN croquis vectoriel schématique** (dessiné trait par trait par la « main
à la craie ») pour une scène du cours *Le Précepteur*, à partir de l'idée d'un
chapitre. La sortie est directement consommable par le composant front
`SketchRenderer` (scène `type:'croquis'` → `scene.sketch`).

- Handler : `index.ts`
- Renderer cible : `apps/app/src/components/school/course-builder/SketchRenderer.jsx`
- Consommateur : `apps/app/src/pages/dev/PrecepteurDemoPage.jsx` (`<SketchRenderer sketch={s.sketch} play />`)
- Cascade LLM : **Groq → DeepSeek → Mistral** (repli croquis minimal si tout échoue), JSON strict (`response_format: json_object`).
- Auth : `requireUser()` (Bearer `x-user-jwt` ou `Authorization`). CORS partagé.
- Facturation LIRI (optionnelle) : `resolveTenant` → `preflightCheck` → `debitUsage` (tenant-scoped).

## Config à ajouter (`supabase/config.toml`)

L'auth est faite par `requireUser`, pas par le gateway — comme les autres edges :

```toml
[functions.liri-preceptor-course]
verify_jwt = false
```

Secrets attendus (au moins un) : `GROQ_API_KEY`, `DEEPSEEK_API_KEY`, `MISTRAL_API_KEY`
(+ `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` pour l'auth/billing).

## Contrat d'ENTRÉE

```jsonc
POST /functions/v1/liri-preceptor-course
Authorization: Bearer <user_jwt>       // ou header x-user-jwt
Content-Type: application/json

{
  "chapterTitle": "Le temps, l’espace, et la spirale",   // string
  "centralIdea":  "Le temps veut continuer ; l’espace le retient → il se courbe.",
  "lessonText":   "Le temps est l’information potentielle qui tend vers la différenciation…"
}
```

Alias `snake_case` acceptés : `chapter_title`, `central_idea`, `lesson_text`.
Au moins un des trois champs est requis (sinon `400`).

## Contrat de SORTIE

```jsonc
{
  "sketch": {
    "caption": "…",                 // optionnel
    "elements": [ /* SketchElement[] */ ]
  },
  "_billing": { … }                 // présent seulement si un tenant est résolu
}
```

### Repère de coordonnées (IMPORTANT)

Le **LLM** raisonne en **coordonnées normalisées `0..1`** (repère naturel, plus
stable). L'edge **dénormalise** vers le repère qu'attend `SketchRenderer` :
**pourcentages `0..100`** du cadre 16:9 (`px = x/100*160`, `py = y/100*90`).
Donc la sortie `sketch.elements[*].from/to/center` est en **0..100**, prête à
brancher sans transformation côté front. `radius` idem (% de la hauteur), `turns`
en nombre de tours.

### Forme d'un `SketchElement`

`kind` ∈ vocabulaire **fermé** : `vector · arrow · line · curve · point · circle · spiral · axis · label`.

| kind | géométrie requise | champs spécifiques |
|---|---|---|
| `vector` / `arrow` / `line` / `curve` | `from:[x,y]`, `to:[x,y]` | `labelSide?: 'above'\|'below'` |
| `point` | `center:[x,y]` | — |
| `circle` | `center:[x,y]` | `radius?` (déf 14) |
| `axis` | `center:[x,y]` | `radius?` (déf 22) |
| `spiral` | `center:[x,y]` | `radius?` (déf 30), `turns?` (déf 2.5) |
| `label` | `center:[x,y]` | `label` (le texte) |

Communs : `color?` (`blue,amber,green,purple,slate,red` — sinon couleur CSS ou `slate`), `label?`, `order?`.

L'edge **sanitise** chaque élément : tout élément dont la géométrie du `kind`
est absente (`from`/`to` pour les segments, `center` pour les ponctuels) est
**écarté** — garantie anti-crash pour `SketchRenderer` (qui accède `el.from[0]`
et `el.center[0]` sans garde). Max 12 éléments conservés.

## Exemple entrée → sortie

**Entrée**

```json
{
  "chapterTitle": "Le temps, l’espace, et la spirale",
  "centralIdea": "Le temps tend à continuer mais l’espace le retient : sa trajectoire se courbe.",
  "lessonText": "La flèche du temps veut filer tout droit ; une force contraire (l’espace) l’oblige à revenir, si bien qu’au lieu d’aller droit elle spirale autour d’un point de gravité."
}
```

**Sortie** (coordonnées déjà dénormalisées en 0..100)

```json
{
  "sketch": {
    "caption": "La flèche du temps courbée par la contrainte de l’espace",
    "elements": [
      { "kind": "vector", "from": [26, 64], "to": [80, 30], "color": "blue",  "label": "flèche du temps",       "labelSide": "above", "order": 1 },
      { "kind": "arrow",  "from": [80, 72], "to": [40, 52], "color": "amber", "label": "contrainte — l’espace", "labelSide": "below", "order": 2 },
      { "kind": "spiral", "center": [52, 48], "turns": 2.6, "radius": 34, "color": "blue",  "label": "le temps spirale", "order": 3 },
      { "kind": "point",  "center": [52, 48], "color": "amber", "label": "point de gravité", "order": 4 }
    ]
  }
}
```

## Appel `curl`

```bash
curl -sS -X POST \
  "$SUPABASE_URL/functions/v1/liri-preceptor-course" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
        "chapterTitle": "Le temps, l’espace, et la spirale",
        "centralIdea": "Le temps veut continuer, l’espace le retient : il se courbe en spirale.",
        "lessonText": "La flèche du temps est contrainte par l’espace et spirale autour d’un point de gravité."
      }'
```

## Branchement front (indicatif)

```js
const res = await supabase.functions.invoke('liri-preceptor-course', {
  body: { chapterTitle, centralIdea, lessonText },
});
// scene.type === 'croquis'
scene.sketch = res.data.sketch;   // <SketchRenderer sketch={scene.sketch} play />
```
