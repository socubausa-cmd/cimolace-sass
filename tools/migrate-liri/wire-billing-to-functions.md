# Plan de câblage LIRI Credits dans les Edge Functions

## ✅ Déjà câblé
- `generate-quiz` — flow complet (preflight → call → debit réel)

## 🎯 À câbler maintenant (priorité usage réel)

### Catégorie 1 — Génération texte (pattern identique à generate-quiz)
- `generate-mindmap` (DeepSeek/Groq)
- `generate-node-explanation` (DeepSeek)
- `liri-smartboard-designer-chat` (DeepSeek)
- `liri-smartboard-architect-structured` (DeepSeek)
- `liri-coach-slide` (DeepSeek)
- `liri-konva-scene-improve` (DeepSeek)
- `liri-agent-course-generate` (DeepSeek)
- `liri-formation-engine` (DeepSeek)
- `neuronq-reformulate` (DeepSeek)
- `studio-cover-prompt-assistant` (DeepSeek)
- `studio-longia-chat` (DeepSeek)
- `answer-question` (RAG → DeepSeek)
- `longia-admin-document` (DeepSeek)

### Catégorie 2 — STT (audio → text, unité = seconds)
- `generate-transcript` (Groq Whisper)

### Catégorie 3 — Multilang (par batch de N langues)
- `liri-multilang-live` (DeepSeek × N langues)
- `liri-multilang-video` (idem)

### Catégorie 4 — Vision IA (Gemini)
- `liri-smartboard-vision-describe`
- `liri-smartboard-vision-segment`

### Catégorie 5 — TTS (caractères)
- `liri-tts` (ElevenLabs, unité chars)

### Catégorie 6 — Images
- `generate-visual-image` (Gemini Imagen)

### Catégorie 7 — Realtime
- `liri-designer-voice-realtime-session` (OpenAI Realtime — billing par minute via webhook)

### Catégorie 8 — Embeddings
- `embed-knowledge` (embeddings DeepSeek/OpenAI)

### Catégorie 9 — Pas de débit (heuristiques pures)
- `longia-live-realtime` — pas d'appel LLM
- `longia-guest-live` — pas d'appel LLM
- `liri-vision-temp-sweep` — cron interne

## Pattern à appliquer dans CHAQUE function

```typescript
// 1. Import en haut
import { resolveTenant, preflightCheck, debitUsage, estimateLlmCost } from '../_shared/aiBilling.ts';

// 2. Après lecture du body, AVANT le call IA :
const ctx = await resolveTenant(req, body);
if (!ctx) return new Response(JSON.stringify({error:'TENANT_NOT_RESOLVED'}), {status:401});

const estimate = await estimateLlmCost(ctx, 'deepseek', 'deepseek-chat', promptText, 800);
const reject = await preflightCheck(ctx, estimate);
if (reject) return reject;

// 3. Track le provider/usage dans le call
const track = { provider: '', model: '', tokens_in: 0, tokens_out: 0 };
// (mettre track.* après chaque appel réussi)

// 4. Avant return du résultat :
if (track.provider) {
  await debitUsage(ctx, { functionName: 'XXX', provider: track.provider, model: track.model,
    unitType: 'tokens_in', unitAmount: track.tokens_in });
  await debitUsage(ctx, { functionName: 'XXX', provider: track.provider, model: track.model,
    unitType: 'tokens_out', unitAmount: track.tokens_out });
}
```
