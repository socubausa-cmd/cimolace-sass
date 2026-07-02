# liri-preceptor-atelier-judge

Edge function (Deno) qui **évalue la réponse d'un élève** à une question d'atelier
du cours « Le Précepteur », et renvoie un **verdict** + une **réaction nominative**
chaleureuse et socratique (le professeur réagit à ce que l'élève a *vraiment* dit).

Même squelette que [`liri-preceptor-course`](../liri-preceptor-course/index.ts) :
`requireUser` (auth exigée), crédits LIRI tenant-scoped (`resolveTenant` +
`preflightCheck` + `debitUsage`), cascade LLM **Groq `llama-3.3-70b-versatile` →
DeepSeek → Mistral**, `response_format: json_object`, CORS/OPTIONS.

## Auth & config

`verify_jwt = false` dans `supabase/config.toml` (la clé anon seule ne suffit pas —
l'auth est vérifiée en code via `requireUser`). Ajouter le bloc :

```toml
[functions.liri-preceptor-atelier-judge]
verify_jwt = false
```

Appel côté front : `supabase.functions.invoke('liri-preceptor-atelier-judge', { body, headers: { Authorization: 'Bearer <access_token>' } })`
(voir le pattern `ttsFetch` dans `apps/app/src/pages/dev/PrecepteurDemoPage.jsx`).

## Entrée (body JSON)

| Champ             | Type       | Requis | Notes                                                            |
|-------------------|------------|:------:|-----------------------------------------------------------------|
| `studentAnswer`   | `string`   |  oui   | La réponse de l'élève. **400** si absent. (`student_answer` accepté) |
| `question`        | `string`   |  non   | L'énoncé de l'atelier.                                           |
| `studentName`     | `string`   |  non   | Prénom, pour une réaction nominative. (`student_name` accepté)   |
| `expectedAnswers` | `string[]` |  non   | Repères de « bonne réponse » (boussole de sens, pas mots-clés).  |
| `expectedErrors`  | `string[]` |  non   | Erreurs / contresens typiquement attendus.                       |
| `hint`            | `string`   |  non   | Indice associé à la question.                                    |
| `lessonContext`   | `string`   |  non   | Contexte de la leçon. (`lesson_context` accepté)                 |

Les clés `camelCase` **et** `snake_case` sont acceptées. Les listes sont nettoyées
(trim, non-vides, max 8 items, ≤300 car. chacun).

## Sortie (JSON)

```json
{ "verdict": "ok" | "partial" | "wrong", "ack": "..." }
```

- `verdict` — **forcé dans l'enum** (`ok` = capte l'idée centrale ; `partial` =
  intuition juste mais incomplète ; `wrong` = contresens / erreur attendue).
  Défaut `partial` si le modèle divague.
- `ack` — réaction ≤ 2 phrases, nominative, variée, qui réagit à la réponse réelle
  (ne récite **pas** la correction). String trim non vide, sinon repli chaleureux.
- `_billing` — objet optionnel (présent seulement si le tenant a des crédits LIRI).

**Repli total** (aucun LLM ne répond / réponse non-JSON / DeepSeek 402) :

```json
{ "verdict": "partial", "ack": "Voyons cela ensemble." }
```

## Exemple

**Requête**

```json
{
  "question": "Pourquoi le ciel est-il bleu ?",
  "studentAnswer": "Parce qu'il reflète la couleur de la mer.",
  "studentName": "Léa",
  "expectedAnswers": ["diffusion de la lumière", "la lumière bleue est diffusée par l'atmosphère"],
  "expectedErrors": ["reflet de la mer", "le ciel est bleu à cause de l'océan"]
}
```

**Réponse**

```json
{
  "verdict": "wrong",
  "ack": "C'est une idée qu'on a tous eue, Léa ! Mais regarde : le ciel reste bleu même au-dessus du désert — alors d'où vient vraiment cette couleur ?"
}
```
