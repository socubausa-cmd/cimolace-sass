/// <reference lib="deno.ns" />
/**
 * agent-brain — cerveau de l'assistant de création d'organisation (immersif) de Cimolace.
 *
 * Public (pré-signup, aucun tenant → aucun billing). À partir du message libre de
 * l'utilisateur + du contexte (moteur pressenti, sujets abordés), renvoie en JSON :
 *   { reply, product, hooks }
 * - reply   : réponse chaleureuse et vivante (voix « vendeur-Précepteur »).
 * - product : "school" | "medos" | "shop" | null (le moteur qui colle au besoin).
 * - hooks   : jusqu'à 2 relances courtes orientées valeur / prix / décision.
 *
 * Chaîne LLM éco : Groq → DeepSeek → OpenAI (mêmes secrets que les autres edges).
 * Front : supabase.functions.invoke('agent-brain', { body: { message, chosen, covered } }).
 */
import { corsHeaders } from '../_shared/cors.ts';

// @ts-ignore - Deno runtime
function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// @ts-ignore - Deno runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // @ts-ignore - Deno runtime
    const groqKey = Deno.env.get('GROQ_API_KEY') || '';
    // @ts-ignore - Deno runtime
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY') || '';
    // @ts-ignore - Deno runtime
    const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
    if (!groqKey && !deepseekKey && !openaiKey) {
      return jsonResponse({ error: 'Missing LLM API keys' }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const message: string = String(body?.message || '').trim();
    const chosen: string = String(body?.chosen || '').trim();
    const covered: string[] = Array.isArray(body?.covered) ? body.covered.map(String) : [];
    const history: Array<{ role: string; content: string }> = Array.isArray(body?.history)
      ? body.history.slice(-6)
      : [];
    if (!message) return jsonResponse({ error: 'message is required' }, 400);

    const system =
      "Tu es l'assistant de création d'organisation de Cimolace — dans l'esprit d'un GRAND FRÈRE / d'une GRANDE SŒUR qui explique (style « Les Sherpas ») : énergique, complice, jamais prof magistral. Phrases COURTES et incarnées, tu/on, énergie constante. Tu attaques par une petite ACCROCHE et tu finis souvent par un « waouh » (payoff). Une analogie concrète du quotidien vaut mieux qu'un jargon. Conseil ET vente HONNÊTE (jamais de fausse urgence ; prix toujours affiché ; on oriente, on ne manipule pas).\n" +
      "Cimolace fournit des « moteurs » métier clés en main, à la marque du client :\n" +
      "- \"school\" = LIRI École (école / cours en ligne) : lives HD, cours, smartboard IA, replay.\n" +
      "- \"medos\" = MedOS (santé / clinique) : dossiers patients, notes SOAP, téléconsultation, RGPD.\n" +
      "- \"shop\" = Virtuel Mbolo (boutique / commerce) : catalogue, panier, mobile money.\n" +
      "Prix : dès 150 €/mois (START), 200 (BUSINESS), 300 (ENTREPRISE) ; installation 500 € une fois ; zéro commission sur les ventes ; espace prêt en quelques minutes.\n" +
      `Contexte — moteur pressenti : ${chosen || 'aucun'} ; sujets déjà abordés : ${covered.join(', ') || 'aucun'}.\n\n` +
      "À partir du message de l'utilisateur, réponds en JSON STRICT (aucun texte hors JSON) :\n" +
      '{\n' +
      '  "reply": "réponse chaleureuse et VIVANTE en français, 1 à 2 phrases ; tu peux poser une question pour faire avancer",\n' +
      '  "product": "school" | "medos" | "shop" | null,\n' +
      '  "topic": "live" | "cours" | "ia" | "replay" | "compare" | "prix" | null,\n' +
      '  "keyword": "le mot-clé FORT à retenir (2 à 3 mots), présent TEL QUEL dans reply",\n' +
      '  "hooks": ["relance courte 1", "relance courte 2"],\n' +
      '  "scene": null\n' +
      '}\n' +
      "Règles :\n" +
      "- \"product\" = le moteur qui correspond au besoin (sinon null si ambigu ou question générale).\n" +
      "- \"topic\" = si ta reply EXPLIQUE un aspect précis, lequel : \"live\" (cours en direct), \"cours\" (cours/leçons à la demande), \"ia\" (smartboard / assistant IA), \"replay\" (enregistrements / replay), \"compare\" (pourquoi Cimolace plutôt que Zoom / un concurrent), \"prix\" (tarifs). Sinon null.\n" +
      "- \"reply\" court, jamais robotique, orienté vers la création d'un espace ; tu peux dérouler UN aspect à la fois (comme un tuto vivant) et enchaîner.\n" +
      "- \"keyword\" = LE terme fort de ta reply (un bénéfice, un résultat, un chiffre, ou « zéro commission », « en direct »…), 2 à 3 mots max, il doit apparaître EXACTEMENT dans reply (il sera surligné à l'écran).\n" +
      "- \"hooks\" = 2 max, relances utiles orientées valeur, prix, comparaison, ou passage à la création — de préférence vers un SUJET non encore abordé (voir contexte).\n" +
      "- Plus l'utilisateur a déjà couvert de sujets (voir contexte), plus tu l'orientes clairement vers la CRÉATION de son espace.\n\n" +
      "── MISE EN SCÈNE (tu es aussi le RÉALISATEUR de l'écran) ──\n" +
      "Par DÉFAUT tu réponds au CENTRE, sans mise en scène : c'est là que se capte l'attention. Dans ce cas mets \"scene\": null (ou omets-le). N'ouvre une scène QUE si le message le demande VRAIMENT, et UNE SEULE à la fois. En cas de doute → \"scene\": null.\n" +
      "\"reply\" reste TOUJOURS ta voix autonome, MÊME avec une scène : elle ANNONCE la scène (« regarde à droite… », « je te montre les deux mondes… », « prends le texte au centre… »). Garde la voix Sherpas + le keyword surligné, sans markdown ni astérisques.\n" +
      "Les 4 scènes possibles (mets l'objet dans \"scene\") :\n" +
      "- { \"type\":\"aside\", \"side\":\"right\", \"title\":str, \"items\":[{label,value,note?}], \"highlight\"?:label } → quand l'utilisateur PARLE de PRIX / paliers / une liste à comparer d'un coup d'œil. 2 à 4 items ; tu restes au centre (reply courte).\n" +
      "- { \"type\":\"split\", \"headline\":str, \"left\":{title,subtitle?,points[2-4]}, \"right\":{title,subtitle?,points[2-4]}, \"tone\":{left?,right?} } → pour OPPOSER DEUX concepts (« le monde d'en haut / d'en bas », vitrine vs coulisses, avant vs après). EXACTEMENT 2 côtés, chacun 2 à 4 points courts. tone ∈ gold|terra.\n" +
      "- { \"type\":\"reader\", \"title\":str, \"profile\":{name,role?,avatarSeed?,facts[0-4]{k,v}}, \"body\":[{h,p}], \"suggestions\":[0-4] } → UNIQUEMENT pour un TEXTE LONG explicitement demandé (biographie, histoire, portrait, « raconte-moi… »). body = plusieurs SECTIONS titrées (jamais un seul pavé), chaque p ≤ 700 caractères. JAMAIS reader pour une simple explication produit. IMPORTANT : si le sujet t'est inconnu (personnage de marque, figure locale, récit d'origine), NE REFUSE PAS : compose un récit ÉVOCATEUR et inspirant en restant général, sans inventer de faits précis vérifiables (dates, chiffres). Le but est de raconter une belle histoire de marque, pas une fiche encyclopédique.\n" +
      "- { \"type\":\"tutorial\", \"title\":str, \"steps\":[{title,detail?,sketch?}], \"cta\"?:str } → pour un PAS-À-PAS / « comment intégrer / brancher / installer … » (ex. intégration LIRI). 2 à 5 étapes. sketch ∈ live|cours|ia|replay|compare|prix (ou omis).\n" +
      "Règles scène : UNE scène par réponse ; sois CONCIS (l'écran est petit) ; respecte les bornes ; contenu français concret, sans markdown. N'utilise \"aside\" pour les prix que si l'utilisateur PARLE de prix ; sinon topic:\"prix\" suffit et scene reste null.\n\n" +
      "Réponds UNIQUEMENT en JSON valide.";

    const messages = [
      { role: 'system', content: system },
      ...history,
      { role: 'user', content: message },
    ];

    const callLLM = async (
      url: string,
      key: string,
      model: string,
      timeoutMs = 22000,
    ): Promise<string | null> => {
      if (!key) return null;
      const abort = new AbortController();
      const t = setTimeout(() => abort.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            temperature: 0.6,
            max_tokens: 700,
            response_format: { type: 'json_object' },
            messages,
          }),
          signal: abort.signal,
        });
        clearTimeout(t);
        if (!res.ok) return null;
        const data = await res.json();
        return String(data?.choices?.[0]?.message?.content || '').trim() || null;
      } catch (_) {
        clearTimeout(t);
        return null;
      }
    };

    const raw =
      (await callLLM('https://api.groq.com/openai/v1/chat/completions', groqKey, 'llama-3.3-70b-versatile')) ||
      (await callLLM('https://api.deepseek.com/chat/completions', deepseekKey, 'deepseek-chat', 32000)) ||
      (await callLLM('https://api.openai.com/v1/chat/completions', openaiKey, 'gpt-4o-mini'));

    if (!raw) return jsonResponse({ error: 'LLM unavailable' }, 503);

    let parsed: { reply?: string; product?: unknown; hooks?: unknown } = {};
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch (_) {
      /* garde le défaut */
    }

    const product = ['school', 'medos', 'shop'].includes(String(parsed.product))
      ? String(parsed.product)
      : null;
    const topic = ['live', 'cours', 'ia', 'replay', 'compare', 'prix'].includes(String(parsed.topic))
      ? String(parsed.topic)
      : null;
    const reply =
      String(parsed.reply || '').replace(/\*+/g, '').replace(/\s+/g, ' ').trim() ||
      "Dites-m'en un peu plus sur votre projet ?";
    const keyword = String(parsed.keyword || '').replace(/\*+/g, '').trim().slice(0, 44);
    const trim = (h: unknown) => {
      const s = String(h).trim();
      return s.length > 84 ? s.slice(0, 84).replace(/\s+\S*$/, '') + '…' : s;
    };
    const hooks = Array.isArray(parsed.hooks)
      ? parsed.hooks.filter(Boolean).map(trim).filter((s) => s.length > 1).slice(0, 2)
      : [];

    // ── Garde-fou de scène (le front reste l'autorité finale via normalizeScene) ──
    // On garantit juste la cohérence type↔objet + l'anti-sur-usage : on RÉTROGRADE
    // (scene→null) si le message ne porte aucun signal correspondant. Jamais de promotion.
    const SCENES = ['aside', 'split', 'reader', 'tutorial'];
    // deno-lint-ignore no-explicit-any
    let scene: any = (parsed as any).scene;
    scene = scene && typeof scene === 'object' && SCENES.includes(String(scene.type)) ? scene : null;
    if (scene) {
      const msg = message.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const SIGNALS: Record<string, RegExp> = {
        aside: /prix|tarif|cout|coute|combien|palier|cher|budget|forfait|formule/,
        split: /difference|deux mondes|cote|coulisse|avant.*apres|versus| vs |oppos|compar/,
        reader: /raconte|histoire|biographie|bio|qui est|fondateur|parcours|origine|portrait|personnage|mascotte|figure|marque|presente|decris|recit/,
        tutorial: /comment (integ|branch|install|ajout|mettre|config)|tuto|etapes|pas a pas|embarqu|sur mon site/,
      };
      const sig = SIGNALS[String(scene.type)];
      if (sig && !sig.test(msg)) scene = null;
    }

    return jsonResponse({ reply, product, topic, keyword, hooks, ...(scene ? { scene } : {}) });
  } catch (e) {
    return jsonResponse({ error: String((e as Error)?.message || e) }, 500);
  }
});
