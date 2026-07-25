import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * EXTRACTEUR DE COURS — transcription d'un live → document pédagogique exploitable.
 *
 * Problème résolu : la transcription brute d'un direct n'est PAS un cours. Elle
 * contient les scories de l'oral (hésitations, reprises, phrases inachevées,
 * digressions, temps morts, salutations, incidents techniques) et n'a aucune
 * structure. Un élève ne peut pas réviser dessus.
 *
 * Méthode MAP-REDUCE (obligatoire : les transcriptions vont jusqu'à ~230 000
 * caractères pour un live de 5 h, très au-delà d'une fenêtre de contexte utile) :
 *   1. SEGMENTATION  — découpe en tranches avec CHEVAUCHEMENT (une idée à cheval
 *      sur deux tranches n'est pas perdue).
 *   2. MAP           — chaque tranche → notions enseignées, NETTOYÉES et
 *      REFORMULÉES en style écrit (le LLM voit le contexte « transcription orale »).
 *   3. REDUCE        — l'ensemble des notions → plan de cours structuré
 *      (modules → leçons), au format Masterclass Factory, + glossaire.
 *
 * Le résultat est renvoyé tel quel (le front en fait un PDF) ; il peut aussi être
 * persisté comme masterclass via MasterclassFactoryService.
 */

export interface CourseLesson {
  title: string;
  content: string;
  key_points?: string[];
}
export interface CourseModule {
  title: string;
  description?: string;
  lessons: CourseLesson[];
}
export interface ExtractedCourse {
  title: string;
  subtitle?: string;
  summary: string;
  objectives: string[];
  modules: CourseModule[];
  glossary?: { term: string; definition: string }[];
  meta: {
    sourceVideoId: string;
    sourceTitle: string;
    durationMin: number;
    transcriptChars: number;
    segments: number;
    model: string;
    generatedAt: string;
  };
}

@Injectable()
export class TranscriptCourseService {
  private readonly logger = new Logger(TranscriptCourseService.name);
  /** Taille d'une tranche envoyée au LLM (caractères). */
  private static readonly CHUNK = 9000;
  /** Chevauchement entre tranches — évite de couper une notion en deux. */
  private static readonly OVERLAP = 600;
  /** Garde-fou : au-delà, on échantillonne (un live de 5 h = ~26 tranches). */
  private static readonly MAX_SEGMENTS = 40;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any {
    return this.supabase.client as any;
  }

  // ── Accès LLM ─────────────────────────────────────────────────────────────
  /**
   * Résout le fournisseur IA. DeepSeek en premier (clé disponible côté plateforme,
   * bon rapport qualité/prix sur du texte long), Groq en repli.
   * ⚠️ Les noms de modèles DeepSeek `deepseek-chat`/`deepseek-reasoner` ont été
   * RETIRÉS par le fournisseur : seuls `deepseek-v4-pro` / `deepseek-v4-flash`
   * répondent (vérifié 2026-07-25). Utiliser un ancien nom = HTTP 400.
   */
  private resolveLlm(fast: boolean) {
    const deepseek = this.config.get<string>('DEEPSEEK_API_KEY');
    const groq = this.config.get<string>('GROQ_API_KEY');
    if (deepseek && deepseek !== 'replace_me') {
      return {
        url: 'https://api.deepseek.com/chat/completions',
        key: deepseek,
        model: fast ? 'deepseek-v4-flash' : 'deepseek-v4-pro',
        provider: 'deepseek',
      };
    }
    if (groq && groq !== 'replace_me') {
      return {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        key: groq,
        model: 'llama-3.3-70b-versatile',
        provider: 'groq',
      };
    }
    throw new ServiceUnavailableException(
      "Génération indisponible : aucune clé IA configurée sur l'API (DEEPSEEK_API_KEY ou GROQ_API_KEY).",
    );
  }

  private async askLlm(
    system: string,
    user: string,
    opts: { fast?: boolean; maxTokens?: number; timeoutMs?: number } = {},
  ): Promise<any> {
    const llm = this.resolveLlm(opts.fast !== false);
    const res = await fetch(llm.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${llm.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: llm.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        max_tokens: opts.maxTokens ?? 4000,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 120000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`${llm.provider} ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = await res.json();
    const raw = json?.choices?.[0]?.message?.content ?? '';
    return TranscriptCourseService.parseJsonLoose(raw);
  }

  /**
   * Parse tolérant. Une réponse peut être TRONQUÉE (limite de tokens atteinte au
   * milieu d'un tableau) — constaté en test réel. On répare alors en fermant les
   * structures ouvertes et en coupant après le dernier élément complet, plutôt
   * que de perdre tout le travail.
   */
  static parseJsonLoose(raw: string): any {
    const text = String(raw || '').trim();
    const start = text.indexOf('{');
    if (start < 0) throw new Error('Réponse IA illisible (JSON absent)');
    const body = text.slice(start);
    try {
      return JSON.parse(body);
    } catch {
      /* tentative de réparation ci-dessous */
    }
    // Coupe après le dernier séparateur d'élément complet, puis referme.
    for (const cut of [body.lastIndexOf('}\n'), body.lastIndexOf('},'), body.lastIndexOf('}')]) {
      if (cut <= 0) continue;
      let candidate = body.slice(0, cut + 1);
      // Referme les tableaux/objets restés ouverts.
      const opens = (candidate.match(/[[{]/g) || []).length;
      const closes = (candidate.match(/[\]}]/g) || []).length;
      const stack: string[] = [];
      for (const ch of candidate) {
        if (ch === '{' || ch === '[') stack.push(ch);
        else if (ch === '}' || ch === ']') stack.pop();
      }
      if (opens > closes) {
        candidate += stack
          .reverse()
          .map((c) => (c === '{' ? '}' : ']'))
          .join('');
      }
      try {
        return JSON.parse(candidate);
      } catch {
        /* on essaie la coupure suivante */
      }
    }
    throw new Error('Réponse IA illisible (JSON malformé, réparation impossible)');
  }

  // ── 1. Segmentation ───────────────────────────────────────────────────────
  private segment(text: string): string[] {
    const { CHUNK, OVERLAP, MAX_SEGMENTS } = TranscriptCourseService;
    const out: string[] = [];
    let i = 0;
    while (i < text.length && out.length < MAX_SEGMENTS) {
      let end = Math.min(i + CHUNK, text.length);
      // Couper de préférence à une fin de phrase pour ne pas trancher une idée.
      if (end < text.length) {
        const window = text.slice(Math.max(i, end - 500), end);
        const lastStop = window.lastIndexOf('. ');
        if (lastStop > 100) end = Math.max(i, end - 500) + lastStop + 1;
      }
      out.push(text.slice(i, end));
      if (end >= text.length) break;
      i = end - OVERLAP;
    }
    return out;
  }

  // ── 2. MAP : une tranche → notions nettoyées ──────────────────────────────
  private async mapSegment(seg: string, idx: number, total: number, courseTitle: string) {
    const system =
      "Tu es un rédacteur pédagogique. Tu reçois la TRANSCRIPTION AUTOMATIQUE BRUTE d'un cours donné EN DIRECT. " +
      "Cette transcription est imparfaite : hésitations, répétitions, phrases inachevées, mots mal transcrits, " +
      "digressions, silences, salutations, incidents techniques (« tu m'entends ? », « attends je partage l'écran »). " +
      'Ta mission : en extraire UNIQUEMENT la substance enseignée, et la RÉÉCRIRE en français écrit, clair et dense. ' +
      'Tu réponds toujours en JSON strict.';

    const user = `Cours : « ${courseTitle} » — extrait ${idx + 1}/${total} de la transcription.

RÈGLES DE RÉÉCRITURE (impératives) :
- SUPPRIME : hésitations, répétitions, reformulations orales, digressions, temps morts, salutations, remarques techniques, interpellations de participants.
- CORRIGE : les mots manifestement mal transcrits, en te fiant au contexte du sujet.
- REFORMULE : passe de l'oral au style ÉCRIT (phrases complètes, vocabulaire précis, aucune scorie). Ne recopie JAMAIS une phrase orale telle quelle.
- CONSERVE : la pensée, les exemples, les analogies, les définitions, la terminologie propre à l'enseignant.
- N'INVENTE RIEN : si l'extrait n'enseigne rien (pur bavardage), renvoie une liste vide.

GRANULARITÉ : produis UNE notion par idée distincte réellement enseignée. Un extrait de cette
longueur en contient généralement 3 à 8. Ne fusionne pas plusieurs idées en une seule notion.

Renvoie ce JSON :
{
  "notions": [
    {
      "titre": "titre court de la notion enseignée",
      "essentiel": "explication rédigée et autonome de 60 à 150 mots, en style écrit",
      "points_cles": ["formulation courte et mémorisable", "…"],
      "termes": [{"terme": "terme technique employé", "definition": "définition en une phrase"}]
    }
  ]
}

TRANSCRIPTION BRUTE :
"""
${seg}
"""`;

    try {
      const j = await this.askLlm(system, user, { fast: true, maxTokens: 3000 });
      return Array.isArray(j?.notions) ? j.notions : [];
    } catch (e) {
      this.logger.warn(`MAP segment ${idx + 1}/${total} échoué : ${(e as Error).message}`);
      return [];
    }
  }

  // ── 3a. REDUCE : notions → PLAN (titres seulement) ────────────────────────
  /**
   * Ne demande QUE la charpente (titres + résumé + objectifs). Réponse courte
   * donc jamais tronquée. La rédaction des leçons se fait ensuite module par
   * module (voir writeModule) — un REDUCE monolithique saturait la limite de
   * tokens et renvoyait un JSON coupé (constaté en test réel).
   */
  private async reducePlan(notions: any[], courseTitle: string, durationMin: number) {
    const system =
      "Tu es architecte pédagogique. Tu reçois les notions extraites d'un cours donné en direct, " +
      'dans leur ordre chronologique. Tu conçois la CHARPENTE du document de cours. JSON strict.';

    const index = notions
      .map((n, i) => `${i + 1}. ${n.titre} — ${String(n.essentiel || '').slice(0, 160)}`)
      .join('\n')
      .slice(0, 20000);

    // Calibrage sur la matière RÉELLE : sans cette borne, le modèle produit un
    // plan « de manuel » (7 modules) même à partir de 2 notions, en inventant des
    // chapitres jamais enseignés (constaté en test : 1 notion → 4 modules).
    const n = notions.length;
    const maxModules = Math.max(1, Math.min(6, Math.ceil(n / 3)));
    const maxLessons = Math.max(1, Math.min(4, Math.ceil(n / Math.max(1, maxModules))));

    const user = `Séance : « ${courseTitle} » (direct de ${durationMin} min).

Conçois le PLAN du document de cours à partir de l'index des notions ci-dessous.
L'index contient ${n} notion(s) — c'est TOUTE la matière disponible.

⛔ INTERDICTION ABSOLUE D'INVENTER :
- Chaque leçon doit être couverte par AU MOINS UNE notion de l'index, citée dans "sources".
- Si une leçon ne peut pas être rattachée à une notion précise, NE LA CRÉE PAS.
- N'ajoute aucun module « d'ouverture », « perspectives », « applications modernes »,
  « comparaison avec d'autres traditions » ou équivalent si l'enseignant n'en a pas parlé.
- Il vaut BIEN MIEUX rendre 1 module honnête que 5 modules inventés.

DIMENSIONNEMENT (impératif, calibré sur la matière) :
- AU PLUS ${maxModules} module(s) et AU PLUS ${maxLessons} leçon(s) par module.
- Si la matière est mince, rends moins que ce maximum.

AUTRES RÈGLES :
- Regroupe par THÈME, pas par ordre d'apparition (un direct part dans tous les sens).
- Fusionne les redites : l'enseignant répète souvent la même idée.
- Titres explicites (pas « Introduction » seul). Français.
- Le "summary" et les "objectives" décrivent ce qui est RÉELLEMENT enseigné dans l'index, rien d'autre.

JSON attendu (AUCUN contenu rédigé à ce stade) :
{
  "title": "titre pédagogique de la séance",
  "subtitle": "sous-titre annonçant le contenu",
  "summary": "résumé de 80 à 150 mots de ce que la séance enseigne",
  "objectives": ["à la fin, l'élève sait …"],
  "modules": [
    { "title": "…", "description": "une phrase", "lessons": [ { "title": "…", "sources": [1,4,7] } ] }
  ]
}

INDEX DES NOTIONS :
"""
${index}
"""`;

    return this.askLlm(system, user, { fast: false, maxTokens: 4000, timeoutMs: 180000 });
  }

  // ── 3b. Rédaction d'UN module (leçons complètes) ──────────────────────────
  private async writeModule(mod: any, notions: any[], courseTitle: string) {
    const system =
      'Tu es rédacteur pédagogique. Tu rédiges les leçons d\'un module de cours à partir des notions ' +
      "issues d'un direct. Style écrit, dense, autonome (lisible sans la vidéo). JSON strict.";

    // N'envoie que les notions citées par le plan (+ repli : tout si non précisé).
    const wanted = new Set<number>();
    (mod.lessons || []).forEach((l: any) =>
      (l.sources || []).forEach((s: any) => wanted.add(Number(s))),
    );
    const pool = wanted.size
      ? [...wanted].map((i) => notions[i - 1]).filter(Boolean)
      : notions.slice(0, 12);
    const material = pool
      .map((n: any, i: number) => `[${i + 1}] ${n.titre}\n${n.essentiel}${(n.points_cles || []).length ? '\nPoints: ' + n.points_cles.join(' | ') : ''}`)
      .join('\n\n')
      .slice(0, 14000);

    const user = `Cours : « ${courseTitle} » — module : « ${mod.title} ».
Leçons à rédiger : ${(mod.lessons || []).map((l: any, i: number) => `${i + 1}) ${l.title}`).join(' ; ')}

RÈGLES :
- Chaque leçon : 120 à 250 mots RÉDIGÉS, en style écrit soigné, autonome.
- Se lit comme un chapitre de manuel, pas comme des notes de prise rapide.
- Conserve les exemples, analogies et la terminologie de l'enseignant.
- ⛔ N'AJOUTE AUCUNE information absente de la MATIÈRE ci-dessous : ni exemple,
  ni référence, ni comparaison, ni développement « culture générale ». Tu REFORMULES
  ce qui a été enseigné, tu ne complètes pas. Une leçon plus courte mais fidèle vaut
  mieux qu'une leçon étoffée par des ajouts.
- 2 à 4 points clés courts et mémorisables par leçon, tirés de la matière.

JSON attendu :
{ "lessons": [ { "title": "titre exact de la leçon", "content": "120-250 mots", "key_points": ["…","…"] } ] }

MATIÈRE :
"""
${material}
"""`;

    try {
      const j = await this.askLlm(system, user, { fast: true, maxTokens: 4000, timeoutMs: 150000 });
      const lessons = Array.isArray(j?.lessons) ? j.lessons : [];
      return lessons.length ? lessons : null;
    } catch (e) {
      this.logger.warn(`Rédaction module « ${mod.title} » échouée : ${(e as Error).message}`);
      return null;
    }
  }

  // ── (ancien REDUCE monolithique — conservé pour référence, non utilisé) ───
  private async reduceToCourse(notions: any[], courseTitle: string, durationMin: number) {
    const system =
      "Tu es architecte pédagogique. Tu reçois les notions extraites d'un cours en direct, dans l'ordre chronologique. " +
      'Tu construis un PLAN DE COURS écrit, progressif et autonome, lisible sans la vidéo. JSON strict.';

    const compact = notions
      .map((n, i) => `${i + 1}. ${n.titre}\n${n.essentiel}${(n.points_cles || []).length ? '\nPoints: ' + (n.points_cles || []).join(' | ') : ''}`)
      .join('\n\n')
      .slice(0, 30000);

    const user = `Titre de la séance : « ${courseTitle} » (durée du direct : ${durationMin} min).

À partir des notions ci-dessous, produis un document de cours STRUCTURÉ.

RÈGLES :
- Regroupe les notions par THÈME (pas par ordre d'apparition) : le direct part souvent dans tous les sens, le document doit être logique.
- Fusionne les redites (un enseignant répète souvent la même idée).
- 3 à 7 modules, 2 à 5 leçons par module.
- Chaque leçon : un contenu RÉDIGÉ de 120 à 250 mots, autonome, compréhensible sans la vidéo.
- Le document doit se lire comme un chapitre de manuel, pas comme des notes.
- Français, ton clair et respectueux du propos de l'enseignant. N'invente aucune notion absente.

JSON attendu :
{
  "title": "titre pédagogique de la séance",
  "subtitle": "sous-titre qui annonce le contenu",
  "summary": "résumé de 80 à 150 mots de ce que la séance enseigne",
  "objectives": ["à la fin, l'élève sait …", "…"],
  "modules": [
    {
      "title": "titre du module",
      "description": "ce que ce module couvre, en une phrase",
      "lessons": [
        { "title": "titre de la leçon", "content": "120-250 mots rédigés", "key_points": ["…", "…"] }
      ]
    }
  ],
  "glossary": [{ "term": "terme", "definition": "définition en une phrase" }]
}

NOTIONS EXTRAITES :
"""
${compact}
"""`;

    return this.askLlm(system, user, { fast: false, maxTokens: 8000, timeoutMs: 180000 });
  }

  // ── Orchestration ─────────────────────────────────────────────────────────
  /**
   * Construit le cours à partir d'un replay publié du tenant.
   * `onProgress` permet au contrôleur de streamer l'avancement (optionnel).
   */
  async buildFromReplay(
    tenantId: string,
    videoId: string,
    onProgress?: (step: string, done: number, total: number) => void,
  ): Promise<ExtractedCourse> {
    const { data: video } = await this.db
      .from('published_videos')
      .select('id, title, transcript_text, duration_sec, tenant_id')
      .eq('id', videoId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!video) throw new NotFoundException('Enregistrement introuvable.');

    const transcript = String(video.transcript_text || '').trim();
    if (transcript.length < 500) {
      throw new BadRequestException(
        "Cet enregistrement n'a pas (ou trop peu) de transcription — impossible d'en extraire un cours.",
      );
    }

    const segments = this.segment(transcript);
    const durationMin = Math.round((video.duration_sec || 0) / 60);
    this.logger.log(
      `Extraction cours : « ${video.title} » — ${transcript.length} car → ${segments.length} segments`,
    );

    // MAP — en petits lots parallèles (le fournisseur limite le débit).
    const notions: any[] = [];
    const BATCH = 4;
    for (let i = 0; i < segments.length; i += BATCH) {
      const slice = segments.slice(i, i + BATCH);
      const res = await Promise.all(
        slice.map((s, k) => this.mapSegment(s, i + k, segments.length, video.title)),
      );
      res.forEach((r) => notions.push(...r));
      onProgress?.('analyse', Math.min(i + BATCH, segments.length), segments.length);
    }

    if (!notions.length) {
      throw new ServiceUnavailableException(
        "L'analyse n'a rien pu extraire de cette transcription (contenu trop bruité ou service IA indisponible).",
      );
    }

    // REDUCE en 2 temps : charpente d'abord, puis rédaction module par module
    // (un seul appel monolithique dépassait la limite de tokens → JSON tronqué).
    onProgress?.('structuration', 0, 1);
    const plan = await this.reducePlan(notions, video.title, durationMin);

    // Garde-fou anti-invention : on écarte les leçons que le plan n'a rattachées
    // à AUCUNE notion réelle (le modèle en ajoute spontanément malgré la consigne).
    let planModules: any[] = Array.isArray(plan?.modules) ? plan.modules : [];
    let dropped = 0;
    planModules = planModules
      .map((m: any) => {
        const kept = (m.lessons || []).filter((l: any) => {
          const ok = Array.isArray(l.sources) && l.sources.some((s: any) => notions[Number(s) - 1]);
          if (!ok) dropped += 1;
          return ok;
        });
        return { ...m, lessons: kept };
      })
      .filter((m: any) => m.lessons.length > 0);
    if (dropped) {
      this.logger.warn(`Plan : ${dropped} leçon(s) sans source réelle écartée(s) (anti-invention).`);
    }
    if (!planModules.length) {
      // Le plan n'a rien rattaché : on retombe sur un module unique fidèle aux notions.
      planModules = [
        {
          title: plan?.title || video.title,
          description: '',
          lessons: notions.slice(0, 4).map((n: any, i: number) => ({ title: n.titre, sources: [i + 1] })),
        },
      ];
    }
    onProgress?.('rédaction', 0, planModules.length);
    for (let i = 0; i < planModules.length; i += 1) {
      const written = await this.writeModule(planModules[i], notions, video.title);
      if (written) {
        planModules[i].lessons = written;
      } else {
        // Repli : on garde les titres du plan avec le meilleur extrait disponible,
        // plutôt que de rendre un module vide.
        planModules[i].lessons = (planModules[i].lessons || []).map((l: any) => ({
          title: l.title,
          content:
            (l.sources || [])
              .map((s: any) => notions[Number(s) - 1]?.essentiel)
              .filter(Boolean)
              .join(' ')
              .slice(0, 900) || 'Contenu non disponible pour cette leçon.',
          key_points: [],
        }));
      }
      onProgress?.('rédaction', i + 1, planModules.length);
    }
    plan.modules = planModules;

    // Glossaire : celui du REDUCE, complété par les termes relevés au MAP.
    const seen = new Set<string>();
    const glossary: { term: string; definition: string }[] = [];
    for (const g of [...(plan.glossary || []), ...notions.flatMap((n: any) => n.termes || [])]) {
      const term = String(g?.term || g?.terme || '').trim();
      const def = String(g?.definition || '').trim();
      if (!term || !def) continue;
      const k = term.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      glossary.push({ term, definition: def });
    }

    const modules: CourseModule[] = Array.isArray(plan.modules) ? plan.modules : [];
    if (!modules.length) {
      throw new ServiceUnavailableException("La structuration n'a produit aucun module exploitable.");
    }

    return {
      title: plan.title || video.title,
      subtitle: plan.subtitle || undefined,
      summary: plan.summary || '',
      objectives: Array.isArray(plan.objectives) ? plan.objectives : [],
      modules,
      glossary: glossary.slice(0, 40),
      meta: {
        sourceVideoId: video.id,
        sourceTitle: video.title,
        durationMin,
        transcriptChars: transcript.length,
        segments: segments.length,
        model: this.resolveLlm(false).model,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}
