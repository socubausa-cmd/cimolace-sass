import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { TranscriptCourseService } from './transcript-course.service';

/**
 * CHAPITRAGE SÉMANTIQUE D'UN REPLAY — de « règle de trois sur l'horloge » à de vrais chapitres.
 *
 * Problème d'origine (constaté en prod, Vidéothèque LIRI) : le lecteur découpait la
 * durée en N parts ÉGALES puis étiquetait chaque borne avec le début de la phrase
 * du cue le plus proche. Sur un direct de 3 h 44 cela donnait « Excuse », « Mais
 * deux fois, c'est no », « Alright So dit que tu, par exemple, parce que vo ».
 * Ce n'est pas un chapitrage : c'est une horloge + des fragments tronqués.
 *
 * Un chapitre, c'est une RUPTURE DE SUJET — pas un intervalle de temps. Seule la
 * lecture du contenu permet de la repérer.
 *
 * ⚠️ DEUXIÈME PROBLÈME, CORRIGÉ ICI (c'est LUI qui produisait « des chapitres faux »
 * malgré le passage à l'IA) : la première version envoyait TOUTE la transcription en
 * UN SEUL appel, en la comprimant pour tenir dans 40 000 caractères. Sur un direct de
 * 3 h 44 cela revenait à ne garder que le DÉBUT et la FIN de chaque bloc de 2 min —
 * mesuré par un relecteur : ~357 caractères conservés sur 1 786, soit ~80 % des mots
 * JETÉS. Le modèle ne lisait jamais le cœur d'un bloc : il ne POUVAIT pas y repérer
 * une rupture de sujet. Un chapitrage bâti sur 20 % du texte est un chapitrage faux.
 *
 * MÉTHODE RETENUE — MAP-REDUCE, exactement le motif que TranscriptCourseService
 * applique déjà aux MÊMES transcriptions (voir son en-tête : elles montent à
 * ~230 000 caractères pour un direct de 5 h) :
 *
 *   1. BLOCS    — les cues sont agrégés en blocs de 30 s, préfixés « [seconde] ».
 *                 Le TEXTE EST INTÉGRAL : plus aucune troncature en régime normal.
 *   2. TRANCHES — ces blocs sont découpés en tranches successives de ~35 000 car.
 *                 avec un RECOUVREMENT de 3 min (une rupture qui tombe pile sur une
 *                 couture reste visible dans les deux tranches voisines).
 *   3. MAP      — un appel LLM RAPIDE (deepseek-v4-flash : c'est du repérage, pas de
 *                 la rédaction) par tranche, borné à sa fenêtre temporelle, qui rend
 *                 les ruptures de sujet DE CETTE TRANCHE.
 *   4. REDUCE   — un dernier appel qui ne reçoit QUE la liste consolidée des ruptures
 *                 candidates (quelques lignes) : il fusionne les doublons de la zone
 *                 de recouvrement, écarte les ruptures mineures, harmonise les titres
 *                 et rend les 5 à 14 chapitres finaux couvrant toute la durée.
 *
 * MESURE (banc local, replay synthétique de 3 h 44 / 265 730 car. de transcription) :
 *   AVANT — 1 appel, 40 000 car. envoyés = 15 % du texte, ~80 % des mots jetés.
 *   APRÈS — 9 tranches, 301 335 car. envoyés = 113 % du texte (les 13 % de surplus
 *           sont le recouvrement, relu volontairement). PLUS UN SEUL MOT PERDU.
 *
 * Le MAP est le travail cher : s'il aboutit et que le REDUCE échoue, on ne le jette
 * PAS — une sélection déterministe des ruptures candidates prend le relais.
 *
 * Économie de jetons : le résultat est PERSISTÉ dans published_videos.chapters.
 * On ne rappelle le modèle que sur demande explicite (`force`). Les élèves LISENT
 * ces chapitres (published_videos remonte au front via zoom-engine), ils ne
 * déclenchent jamais la génération — la route est réservée aux créateurs.
 */

export interface ReplayChapter {
  /** Seconde de départ (entier, croissant, le premier chapitre commence à 0). */
  t: number;
  /** Titre nominal de 3 à 8 mots — jamais un fragment de transcription. */
  label: string;
  /** Une phrase (≤ 160 car.) résumant ce qui est dit dans le chapitre. */
  summary?: string;
}

export interface ReplayChaptersResult {
  chapters: ReplayChapter[];
  generated_at: string;
  /** 'ia' = chapitrage sémantique ; 'repli' = heuristique locale (silences). */
  source: 'ia' | 'repli';
  /**
   * Le résultat a-t-il bien été ÉCRIT dans published_videos ? `false` = le front
   * affiche les chapitres mais les élèves ne les verront PAS (et le prochain clic
   * refacturera des jetons). Sans ce drapeau, un échec d'écriture (colonne absente
   * sur une instance en retard, RLS…) passait pour un succès complet.
   * `undefined` quand la question ne se pose pas (cache, ou repli non persistable).
   */
  persisted?: boolean;
}

/** Une tranche de transcription envoyée à UN appel MAP. */
interface Tranche {
  /** Seconde du premier bloc de la tranche (borne basse annoncée au modèle). */
  debut: number;
  /** Seconde de fin approchée du dernier bloc (borne haute annoncée au modèle). */
  fin: number;
  /** Les lignes « [seconde] texte », texte INTÉGRAL, séparées par des sauts de ligne. */
  texte: string;
}

/**
 * Erreur d'appel LLM porteuse du CODE HTTP. Sans lui, on ne peut pas distinguer un
 * 429 (fournisseur saturé → il faut attendre avant de réessayer) d'un 400 (requête
 * invalide → réessayer ne sert à rien) : le message texte seul obligeait à faire de
 * l'archéologie sur une chaîne de caractères.
 */
class ErreurLlm extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ErreurLlm';
  }
}

/**
 * Débuts de titre refusés — DEUX FAMILLES DE FILTRES, pour deux usages qui n'ont
 * rien à voir :
 *
 *  A) `DEBUT_INTERDIT` / `DEBUT_INTERDIT_SOUPLE` — filtres du REPLI LOCAL, où
 *     l'étiquette est une PHRASE RECOPIÉE de la transcription. Là, il faut être
 *     sévère : tout ce qui commence par un connecteur, un tic, un pronom ou un
 *     démonstratif est un fragment d'oral. Ces deux listes sont le MIROIR EXACT de
 *     celles du lecteur (ImmersiveVideoPlayer — les deux applications ne partagent
 *     aucun bundle) : ne les modifier qu'en modifiant le front en même temps.
 *
 *  B) `DEBUT_TITRE_INTERDIT` / `DEBUT_TITRE_PRONOM` — filtres des TITRES RENDUS PAR
 *     LE MODÈLE. Ils sont volontairement PLUS SOUPLES.
 *     ⚠️ PIÈGE CORRIGÉ : appliquer le filtre (A) aux titres du modèle rejetait des
 *     titres parfaitement nominaux — « Ce que révèle la loi fondamentale »,
 *     « Cette cosmogonie oubliée », « Comment naît une province », « Pourquoi… »,
 *     « Quand le Kongo bascule », « Où commence le fleuve » — parce que « ce »,
 *     « cette », « comme », « quand », « si », « où » figurent dans ANAPHORES. Un
 *     titre rejeté = un chapitre PERDU, et (avant le correctif de `valider`) c'est
 *     le chapitre SUIVANT qui héritait de t = 0.
 *     Ne restent interdits que les VRAIS fragments : conjonction de coordination en
 *     tête, tic d'oral, ou pronom sujet immédiatement suivi de sa suite de phrase.
 *
 * ⚠️ « la » (article) n'est interdit dans AUCUNE liste — « La circulation sanguine… »
 * est un bon titre ; seul « là » (adverbe accentué) l'est. Confondre les deux faisait
 * retomber toutes les étiquettes sur « Partie N » (vérifié en test).
 */
const TICS =
  "et|mais|donc|or|alors|car|parce|puis|ensuite|voilà|voila|bon|ben|euh|ok|okay|oui|non|que|qu'|qui|quoi|dont|ou|enfin|bref|du coup|en fait|attends|attendez|excuse|excusez|alright|so|well";
const ANAPHORES =
  "où|c'est|ça|ca|cela|ce|cet|cette|ces|je|j'|tu|il|elle|on|nous|vous|ils|elles|là|ici|si|quand|comme|par exemple";
const DEBUT_INTERDIT = new RegExp(`^(${TICS}|${ANAPHORES})\\b`, 'i');
const DEBUT_INTERDIT_SOUPLE = new RegExp(`^(${TICS})\\b`, 'i');

/**
 * (B1) Conjonctions de coordination + tics d'oral + locutions de liaison.
 * La lookahead `(?=[\s,;:!?…]|$)` exige que le mot soit COMPLET : « Non-dualité » et
 * « Ontologie » passent (le mot ne s'arrête pas là), « Non, on continue » ne passe pas.
 * Faux positif connu et assumé : « Or et argent du royaume » (le métal) est rejeté
 * comme s'il s'agissait de la conjonction. Coût nul en pratique — « L'or et le
 * cuivre » passe, et un titre commençant par le mot nu « Or » est bien plus souvent
 * un fragment d'oral qu'une accroche sur le métal (vérifié au banc).
 */
const TITRE_TIC =
  "et|ou|mais|donc|or|ni|car|puis|ensuite|alors|voilà|voila|bon|bah|ben|beh|euh|heu|hum|ok|okay|oui|non|bref|enfin|attends|attendez|excuse|excusez|pardon|alright|so|well|yeah|hein";
const TITRE_LOCUTION = "parce que|du coup|en fait|par exemple|c'est-à-dire|est-ce que|tu vois|vous voyez";
const DEBUT_TITRE_INTERDIT = new RegExp(`^(?:${TITRE_TIC}|${TITRE_LOCUTION})(?=[\\s,;:!?…]|$)`, 'i');

/**
 * (B2) Pronom sujet en tête = phrase, pas titre. Le `\b` protège les mots qui
 * COMMENCENT par ces lettres : « Ontologie » (on), « Illusion » (il), « Calendrier »
 * (ca), « Elleboré »… ne sont pas touchés.
 * Approximation assumée : on ne vérifie pas que le mot suivant est bien un verbe
 * conjugué (il faudrait un lexique). Un titre nominal démarrant par « Nous » ou
 * « Elle » est en pratique inexistant ; le coût du faux positif est nul.
 */
const DEBUT_TITRE_PRONOM = /^(?:je|j['’]|tu|il|elle|on|nous|vous|ils|elles|c['’]est|ça|ca|cela)\b/i;

/**
 * (B3) Mots isolés VIDES DE SENS. Un titre d'UN SEUL mot fort est parfaitement
 * valable (« Cosmogonie », « Kimbanguisme », « Thermodynamique ») : l'ancienne règle
 * « moins de 2 mots → rejet » les jetait tous. On ne rejette donc plus que le mot
 * unique qui ne dit RIEN du contenu.
 */
const MOT_UNIQUE_VIDE = new Set([
  'partie', 'chapitre', 'section', 'segment', 'passage', 'suite', 'fin', 'debut',
  'début', 'intro', 'introduction', 'conclusion', 'transition', 'divers', 'autre',
  'autres', 'sujet', 'moment', 'chose', 'truc', 'question', 'questions', 'remarque',
  'pause', 'reprise', 'notes', 'resume', 'résumé', 'etc',
]);

@Injectable()
export class ReplayChaptersService {
  private readonly logger = new Logger(ReplayChaptersService.name);

  /** Plafond absolu (le lecteur devient illisible au-delà). */
  private static readonly MAX_CHAPITRES = 24;
  /** Cadence visée : une borne toutes les ~12 min de parole. */
  private static readonly MINUTES_PAR_CHAPITRE = 12;

  /**
   * PLAFOND PROPORTIONNEL À LA DURÉE — et non un 14 fixe.
   *
   * ⚠️ MESURÉ sur le replay « L'arbre du Manikongo — 22 août » (3 h 45) : avec un
   * plafond fixe à 14, le MAP repérait bien 29 ruptures réelles mais le REDUCE, à
   * qui l'on ne demandait que 9 à 13 chapitres, en jetait la moitié — dont SEPT
   * dans deux fenêtres qui se retrouvaient sans le moindre repère (51 min et
   * 32 min : « Retour sur le cas d'Hitler », « Pouvoir des ongles et des cheveux »,
   * « Jumeaux et anniversaires karmiques »… tous perdus). Le défaut n'était donc
   * ni dans le repérage ni dans le prompt, mais dans le calibrage : 14 chapitres
   * conviennent à un cours d'une heure, pas à un direct de près de quatre.
   *
   * Un cours court garde un minimum de 5 bornes ; un très long direct plafonne à
   * MAX_CHAPITRES pour que le rail reste lisible.
   */
  private static plafondChapitres(dureeSec: number): number {
    const minutes = Math.max(0, Number(dureeSec) || 0) / 60;
    const vise = Math.round(minutes / ReplayChaptersService.MINUTES_PAR_CHAPITRE);
    return Math.max(5, Math.min(ReplayChaptersService.MAX_CHAPITRES, vise));
  }
  /**
   * Écart minimal toléré entre deux bornes. La consigne au modèle est « au moins
   * ~4 min » ; on valide plus souplement (2 min 30) pour ne pas jeter une vraie
   * rupture rapprochée, tout en éliminant les doublons quasi-simultanés.
   */
  private static readonly ECART_MIN_SEC = 150;

  // ── Découpage MAP ─────────────────────────────────────────────────────────
  /** Granularité des blocs horodatés proposés au modèle. */
  private static readonly FENETRE_BLOC_SEC = 30;
  /**
   * Taille visée d'une tranche envoyée à UN appel MAP. ~35 000 caractères ≈ 10 000
   * jetons : largement dans la fenêtre de contexte utile, et surtout une quantité
   * que le modèle lit VRAIMENT (au-delà, l'attention se dilue et il survole).
   */
  private static readonly TRANCHE_CAR = 35000;
  /** Plafond d'élargissement quand MAX_TRANCHES est atteint (voir `decouper`). */
  private static readonly TRANCHE_CAR_MAX = 90000;
  /**
   * Recouvrement entre deux tranches. Une rupture de sujet s'annonce quelques
   * dizaines de secondes avant la borne (« bon, on va passer à… ») : sans marge,
   * une rupture tombant sur une couture n'est complètement lue par AUCUNE des deux
   * tranches. 3 min couvrent largement une amorce de transition.
   */
  private static readonly RECOUVREMENT_SEC = 180;
  /**
   * Garde-fou : nombre maximal d'appels MAP. Au-delà, on ÉLARGIT les tranches au
   * lieu d'empiler les appels (chaque appel coûte du temps mur ET des jetons).
   * 12 tranches × 35 000 car. = 420 000 car. de couverture à granularité normale,
   * soit ~9 h de direct : très au-delà du pire cas observé (3 h 44 → ~7 tranches).
   */
  private static readonly MAX_TRANCHES = 12;
  /**
   * Appels MAP simultanés. ⚠️ DeepSeek renvoie des 429 en rafale quand on tape trop
   * fort — cela a déjà coûté des générations entières sur ce projet. 3 en vol est le
   * compromis retenu (TranscriptCourseService tourne à 4, mais sur des tranches 4×
   * plus petites). Un backoff sur 429/5xx complète la protection (voir `askLlm`).
   */
  private static readonly CONCURRENCE_MAP = 3;

  // ── Bornage de l'index envoyé au REDUCE ───────────────────────────────────
  /**
   * ⚠️ DÉFAUT CORRIGÉ ICI — LA FIN DU DIRECT N'ARRIVAIT JAMAIS AU REDUCE.
   *
   * L'index des ruptures candidates était tronqué À L'AVEUGLE sur les CARACTÈRES
   * (`.slice(0, 12000)`). Or cette liste est CHRONOLOGIQUE : couper la chaîne, c'est
   * amputer systématiquement la QUEUE du direct. Le REDUCE ne voyait alors plus
   * aucune candidate après la coupure — il ne pouvait donc poser aucun chapitre sur
   * la fin, et il « réussissait » (donc aucun repli déclenché, aucun log, rien).
   *
   * Aggravant : `lireRuptures` ne plafonnait PAS le nombre de ruptures rendues par
   * une tranche, alors que le prompt ne fait que SUGGÉRER « environ N ». Rien ne
   * bornait donc la longueur de l'index. Une ligne pesant jusqu'à ~305 car.
   * (`- t=` + mm:ss + label ≤ 120 + summary ≤ 160), 12 000 car. ne laissaient
   * passer que ~40 candidates.
   * Banc : replay de 3 h 45, 6 tranches × 10 ruptures = index de 18 272 car. →
   * 40 candidates sur 60 vues, dernière borne à 2:26:44, soit 1 h 19 (35 % du
   * replay) sans le moindre chapitre alors que les ruptures existaient bien.
   *
   * TROIS VERROUS, dans cet ordre — aucun ne coupe jamais sur la longueur d'une
   * chaîne :
   *  1. la SOURCE est bornée (ruptures par tranche, voir `lireRuptures`) ;
   *  2. le résumé de l'index est raccourci (il ne sert qu'au JUGEMENT du REDUCE ;
   *     le résumé final vient du REDUCE lui-même ou est restauré depuis la
   *     candidate, voir `restaurerResumes`) ;
   *  3. s'il reste trop de candidates, on échantillonne sur le NOMBRE, RÉPARTI sur
   *     TOUTE la durée (`echantillonnerReparti`) — la fin reste représentée.
   */
  /**
   * Ruptures retenues par tranche MAP = ce facteur × le nombre annoncé au modèle.
   * ×2 laisse au modèle le droit de dépasser la suggestion (une tranche peut
   * réellement contenir plus de ruptures que la moyenne) sans qu'une dérive puisse
   * faire exploser l'index. Ce qui dépasse est ÉCHANTILLONNÉ, jamais tronqué.
   */
  private static readonly TOLERANCE_RUPTURES = 2;
  /** Plancher du plafond précédent : une tranche garde toujours au moins 3 ruptures. */
  private static readonly MIN_RUPTURES_TRANCHE = 3;
  /**
   * Longueur du résumé d'une candidate DANS L'INDEX du REDUCE (le résumé complet,
   * lui, reste à 160 car. côté serveur). 80 car. suffisent au REDUCE pour juger
   * qu'une rupture est majeure ou mineure, et divisent par ~2 le poids de l'index.
   */
  private static readonly RESUME_INDEX_CAR = 80;
  /**
   * Plafond DUR du nombre de candidates soumises au REDUCE. Pire cas structurel :
   * 90 lignes × ~226 car. ≈ 20 000 car. (~6 000 jetons) — une taille CONNUE, très
   * loin de la fenêtre du modèle, et surtout obtenue par échantillonnage réparti et
   * non par amputation de la queue.
   */
  private static readonly MAX_CANDIDATES_REDUCE = 90;

  // ── Budgets de temps (voir le PIRE CAS documenté sur `generate`) ───────────
  /** Enveloppe TOTALE de la phase MAP, tous appels et tous backoffs confondus. */
  private static readonly BUDGET_MAP_MS = 360000; // 6 min
  /** Plafond d'UN appel MAP (rogné si l'enveloppe MAP restante est plus courte). */
  private static readonly TIMEOUT_MAP_MS = 75000;
  /** Plafond d'UNE tentative du REDUCE (3 tentatives au pire → 4 min 30). */
  private static readonly TIMEOUT_REDUCE_MS = 90000;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any {
    return this.supabase.client as any;
  }

  // ── Accès LLM ─────────────────────────────────────────────────────────────
  // resolveLlm/askLlm sont RECOPIÉS de TranscriptCourseService (mêmes patterns,
  // même résilience) et non réutilisés par injection : ces deux méthodes y sont
  // `private`, et ce fichier-là n'est pas dans notre périmètre d'écriture (on ne
  // peut donc pas les exposer). En revanche `parseJsonLoose` y est PUBLIQUE et
  // STATIQUE : on la réutilise telle quelle (aucune dépendance DI ajoutée).

  /**
   * Résout le fournisseur IA. DeepSeek d'abord, Groq en repli.
   * ⚠️ `deepseek-chat`/`deepseek-reasoner` ont été RETIRÉS par le fournisseur :
   * seuls `deepseek-v4-pro` / `deepseek-v4-flash` répondent. Un ancien nom = HTTP 400.
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
      "Chapitrage indisponible : aucune clé IA configurée sur l'API (DEEPSEEK_API_KEY ou GROQ_API_KEY).",
    );
  }

  /** Pause coopérative (backoff). */
  private pause(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Appel LLM RÉSILIENT.
   *
   * 1. `deepseek-v4-pro` est un modèle à raisonnement : sa réflexion interne peut
   *    absorber tout le budget de tokens et renvoyer un `content` VIDE (HTTP 200
   *    mais rien d'exploitable). On réessaie, puis on bascule sur le modèle rapide.
   * 2. BACKOFF sur 429 / 5xx : avec plusieurs tranches en vol, DeepSeek limite le
   *    débit. Relancer immédiatement ne fait qu'empiler les refus ; on attend donc
   *    (exponentiel + gigue, pour ne pas resynchroniser les ouvriers entre eux).
   * 3. ÉCHÉANCE GLOBALE (`echeance`) : le timeout de CHAQUE tentative est rogné sur
   *    le temps restant de l'enveloppe. Sans cela, 12 tranches × 2 tentatives ×
   *    75 s auraient pu dépasser à elles seules le timeout du client front.
   */
  private async askLlm(
    system: string,
    user: string,
    opts: {
      fast?: boolean;
      maxTokens?: number;
      timeoutMs?: number;
      /** Date (ms epoch) au-delà de laquelle on abandonne, quoi qu'il arrive. */
      echeance?: number;
      /** Préfixe de journalisation (« MAP 3/7 », « REDUCE »…). */
      etiquette?: string;
    } = {},
  ): Promise<any> {
    const maxTokens = opts.maxTokens ?? 4000;
    const timeoutMs = opts.timeoutMs ?? 180000;
    const etiquette = opts.etiquette ?? 'IA';
    const attempts: boolean[] = opts.fast === false ? [false, false, true] : [true, true];
    let lastErr: Error | null = null;

    for (let i = 0; i < attempts.length; i += 1) {
      // Il reste combien de temps ? En dessous de 5 s, un appel ne peut pas aboutir :
      // on rend la main tout de suite plutôt que de brûler l'échéance du voisin.
      const reste = opts.echeance ? opts.echeance - Date.now() : Number.POSITIVE_INFINITY;
      if (reste <= 5000) {
        throw lastErr ?? new Error(`${etiquette} : budget de temps épuisé avant l'appel.`);
      }
      // `resolveLlm` DOIT rester dans le `try` : quand aucune clé n'est configurée
      // il lève une ServiceUnavailableException, qui autrement traversait `askLlm`
      // sans être capturée et faisait remonter un 503 au créateur — au lieu de
      // laisser `executer` descendre proprement sur le repli local.
      let llm: ReturnType<ReplayChaptersService['resolveLlm']> | null = null;
      try {
        llm = this.resolveLlm(attempts[i]);
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
            // Budget élargi au fil des tentatives (le raisonnement en consomme).
            max_tokens: Math.min(16000, Math.round(maxTokens * (1 + i * 0.5))),
            temperature: 0.2,
          }),
          signal: AbortSignal.timeout(Math.max(5000, Math.min(timeoutMs, reste))),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          throw new ErreurLlm(`${llm.provider} ${res.status}: ${t.slice(0, 200)}`, res.status);
        }
        const json = await res.json();
        const raw = String(json?.choices?.[0]?.message?.content ?? '').trim();
        if (!raw) throw new Error(`${llm.model}: réponse vide (budget de tokens absorbé)`);
        return TranscriptCourseService.parseJsonLoose(raw);
      } catch (e) {
        lastErr = e as Error;
        this.logger.warn(
          `${etiquette} tentative ${i + 1}/${attempts.length} (${llm?.model ?? 'aucun modèle résolu'}) : ${(e as Error).message}`,
        );
        const status = (e as ErreurLlm).status;
        const surcharge = status === 429 || (typeof status === 'number' && status >= 500);
        if (surcharge && i < attempts.length - 1) {
          // 1,2 s → 2,4 s → 4,8 s (plafonné 8 s), + gigue pour désynchroniser les
          // ouvriers qui se sont pris le même 429 à la même milliseconde.
          await this.pause(Math.min(8000, 1200 * 2 ** i) + Math.floor(Math.random() * 400));
        }
      }
    }
    throw lastErr ?? new Error('Appel IA impossible');
  }

  // ── Préparation de la transcription ───────────────────────────────────────
  /**
   * Agrège les cues en blocs de `fenetreSec`, chacun repéré par sa seconde de
   * départ ENTIÈRE. Le modèle a besoin de ce repère pour situer les ruptures —
   * sans lui, il ne peut renvoyer que des titres.
   */
  private agreger(
    cues: { t: number; text: string }[],
    fenetreSec: number,
  ): { t: number; texte: string }[] {
    const blocs: { t: number; texte: string }[] = [];
    let debut = -1;
    let buf: string[] = [];
    const vider = () => {
      if (debut >= 0 && buf.length) {
        const texte = buf.join(' ').replace(/\s+/g, ' ').trim();
        if (texte) blocs.push({ t: Math.round(debut), texte });
      }
      buf = [];
    };
    for (const c of cues) {
      if (debut < 0 || c.t - debut >= fenetreSec) {
        vider();
        debut = c.t;
      }
      buf.push(c.text);
    }
    vider();
    return blocs;
  }

  /**
   * Resserre un bloc à `max` caractères en gardant son DÉBUT **et** sa FIN.
   *
   * ⚠️ GARDE-FOU DE DERNIER RECOURS UNIQUEMENT — plus jamais le régime normal.
   * C'est cette fonction qui, appliquée systématiquement, jetait ~80 % des mots et
   * rendait les ruptures invisibles au modèle (voir l'en-tête du fichier). Elle ne
   * sert désormais que si la transcription dépasse MAX_TRANCHES × TRANCHE_CAR_MAX
   * (≈ 1 000 000 de caractères, soit plus de 24 h de parole) : à ce stade, un survol
   * très serré vaut mieux qu'un budget explosé. Aucun replay réel n'y touche.
   *
   * On garde début ET fin — jamais une simple troncature — parce qu'une rupture de
   * sujet s'annonce souvent dans les dernières phrases d'un bloc. On coupe sur des
   * frontières de mot (jamais « parce que vo »).
   */
  private resserrer(texte: string, max: number): string {
    if (texte.length <= max) return texte;
    const tete = Math.max(60, Math.round(max * 0.62));
    const queue = Math.max(40, max - tete - 5);
    const debut = texte.slice(0, tete).replace(/\s+\S*$/, '');
    const fin = texte.slice(Math.max(0, texte.length - queue)).replace(/^\S*\s+/, '');
    return `${debut} […] ${fin}`;
  }

  /**
   * DÉCOUPAGE EN TRANCHES (étape 2 du MAP-REDUCE).
   *
   * Le budget porte sur la taille d'UNE tranche, jamais sur le texte lui-même : le
   * texte de chaque bloc part INTÉGRALEMENT au modèle. Si la transcription est très
   * longue, on ajoute des tranches ; si elles deviendraient trop nombreuses
   * (MAX_TRANCHES), on ÉLARGIT les tranches — et seulement en toute dernière
   * extrémité (plafond TRANCHE_CAR_MAX atteint) on resserre le texte des blocs.
   */
  private decouper(blocsEntree: { t: number; texte: string }[]): {
    tranches: Tranche[];
    carTotal: number;
    resserre: boolean;
  } {
    const {
      TRANCHE_CAR,
      TRANCHE_CAR_MAX,
      MAX_TRANCHES,
      RECOUVREMENT_SEC,
      FENETRE_BLOC_SEC,
    } = ReplayChaptersService;

    // (0) Garde-fou de dernier recours : au-delà de ce que MAX_TRANCHES tranches
    //     élargies au maximum peuvent absorber, on resserre le TEXTE des blocs.
    let blocs = blocsEntree;
    let resserre = false;
    const plafond = MAX_TRANCHES * TRANCHE_CAR_MAX;
    const brut = blocs.reduce((n, b) => n + b.texte.length + 12, 0);
    if (brut > plafond && blocs.length) {
      const parBloc = Math.max(160, Math.floor(plafond / blocs.length) - 12);
      blocs = blocs.map((b) => ({ t: b.t, texte: this.resserrer(b.texte, parBloc) }));
      resserre = true;
    }

    const lignes = blocs.map((b) => `[${b.t}] ${b.texte}`);
    const total = lignes.reduce((n, l) => n + l.length + 1, 0);
    // Taille visée : la plus PETITE qui permette de tout couvrir en ≤ MAX_TRANCHES.
    // Le facteur 1,15 provisionne le recouvrement (chaque tranche relit un bout de
    // la précédente) : sans lui, on débordait systématiquement d'une tranche.
    const taille = Math.min(
      TRANCHE_CAR_MAX,
      Math.max(TRANCHE_CAR, Math.ceil((total * 1.15) / MAX_TRANCHES)),
    );

    const tranches: Tranche[] = [];
    let i = 0;
    while (i < blocs.length && tranches.length < MAX_TRANCHES) {
      let j = i;
      let car = 0;
      // Dernière tranche autorisée : elle absorbe TOUT le reste, pour ne jamais
      // laisser la fin du direct hors couverture (le pire défaut possible ici).
      const derniere = tranches.length === MAX_TRANCHES - 1;
      while (j < blocs.length && (derniere || car < taille)) {
        car += lignes[j].length + 1;
        j += 1;
      }
      tranches.push({
        debut: blocs[i].t,
        fin: blocs[j - 1].t + FENETRE_BLOC_SEC,
        texte: lignes.slice(i, j).join('\n'),
      });
      if (j >= blocs.length) break;
      // RECOUVREMENT : la tranche suivante redémarre RECOUVREMENT_SEC avant la fin
      // de celle-ci. `k > i + 1` garantit la progression (jamais de boucle infinie
      // si une seule tranche couvre déjà plus que le recouvrement demandé).
      const cible = blocs[j - 1].t - RECOUVREMENT_SEC;
      let k = j;
      while (k > i + 1 && blocs[k - 1].t >= cible) k -= 1;
      i = k;
    }

    const carTotal = tranches.reduce((n, t) => n + t.texte.length, 0);
    return { tranches, carTotal, resserre };
  }

  // ── Pool à concurrence bornée ─────────────────────────────────────────────
  /**
   * Exécute `tache` sur tous les éléments avec au plus `limite` appels EN VOL.
   * Volontairement écrit à la main (aucune dépendance ajoutée à l'API) et sans
   * `Promise.all` par lots : un lot de 3 attend son traînard avant de démarrer le
   * suivant, ce qui gaspille jusqu'à un timeout complet par lot. Ici, dès qu'un
   * ouvrier se libère il prend la tranche suivante.
   * `tache` NE DOIT PAS rejeter (chaque MAP capture ses propres erreurs).
   */
  private async enFlotte<T, R>(
    items: T[],
    limite: number,
    tache: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let curseur = 0;
    const ouvrier = async () => {
      for (;;) {
        const i = curseur;
        curseur += 1;
        if (i >= items.length) return;
        out[i] = await tache(items[i], i);
      }
    };
    await Promise.all(
      Array.from({ length: Math.max(1, Math.min(limite, items.length)) }, ouvrier),
    );
    return out;
  }

  // ── Échantillonnage réparti ───────────────────────────────────────────────
  /**
   * Garde `cible` entrées choisies au plus près d'une répartition RÉGULIÈRE sur
   * [debut, fin] — la seule façon honnête de réduire une liste chronologique.
   *
   * ⚠️ C'est le remplaçant des troncatures : couper la fin d'une liste triée par le
   * temps, c'est effacer la fin du direct. Ici, quel que soit le nombre d'entrées
   * jetées, il en reste au début, au milieu ET à la fin.
   *
   * Les bornes sont INCLUSES (`(cible - 1)` au dénominateur) : la toute première et
   * la toute dernière rupture sont toujours des cibles, donc quasi toujours
   * retenues. C'est ce qui distingue cette fonction de `selectionDeterministe`, qui
   * vise `(duree × k) / cible` — délibérément, car là ce sont des DÉBUTS de
   * chapitre, et un chapitre ne doit pas commencer à la dernière seconde.
   *
   * Purement déterministe (aucun aléa) : deux runs sur les mêmes candidates rendent
   * exactement la même sélection.
   */
  private echantillonnerReparti<T extends { t: number }>(
    liste: T[],
    cible: number,
    debut: number,
    fin: number,
  ): T[] {
    if (cible <= 0) return [];
    const tries = [...liste].sort((a, b) => a.t - b.t);
    if (tries.length <= cible) return tries;

    const etendue = Math.max(1, fin - debut);
    const gardes: T[] = [];
    const pris = new Set<number>();
    for (let k = 0; k < cible; k += 1) {
      const viser = debut + (etendue * k) / Math.max(1, cible - 1);
      let meilleur = -1;
      let dist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < tries.length; i += 1) {
        if (pris.has(i)) continue;
        const d = Math.abs(tries[i].t - viser);
        if (d < dist) {
          dist = d;
          meilleur = i;
        }
      }
      if (meilleur < 0) break;
      pris.add(meilleur);
      gardes.push(tries[meilleur]);
    }
    return gardes.sort((a, b) => a.t - b.t);
  }

  // ── MAP : une tranche → ses ruptures de sujet ─────────────────────────────
  private async mapTranche(
    tr: Tranche,
    idx: number,
    total: number,
    titre: string,
    echeance: number,
  ): Promise<ReplayChapter[]> {
    const system =
      "Tu es monteur pédagogique. Tu reçois un EXTRAIT de la transcription HORODATÉE d'un cours " +
      'donné en direct, découpé en blocs préfixés par leur seconde de départ. Ta mission : repérer ' +
      'dans CET EXTRAIT les moments où le SUJET CHANGE. Tu réponds toujours en JSON strict.';

    // Combien de ruptures attendre ? Une rupture tous les ~8 min en moyenne, borné :
    // annoncer un ordre de grandeur évite les deux dérives (0 rupture rendue, ou une
    // rupture tous les 30 s parce que le modèle « segmente » au lieu de chapitrer).
    const dureeTrancheMin = Math.max(1, Math.round((tr.fin - tr.debut) / 60));
    const attendues = Math.max(1, Math.min(6, Math.round(dureeTrancheMin / 8)));
    const premiere = idx === 0;

    const user = `Séance : « ${titre || 'Session enregistrée'} ».
EXTRAIT ${idx + 1}/${total} — il couvre de ${tr.debut} s (${ReplayChaptersService.mmss(tr.debut)}) à ${tr.fin} s (${ReplayChaptersService.mmss(tr.fin)}).

⛔ NE DÉCOUPE PAS LE TEMPS EN PARTS ÉGALES. Une rupture n'est pas un intervalle d'horloge :
c'est un MOMENT OÙ LE SUJET CHANGE. Cherche-la dans le CONTENU :
- passage à un nouveau thème ou à une nouvelle notion ;
- début d'un exemple, d'une démonstration, d'un exercice ;
- question du public qui ouvre un développement ;
- digression assumée, pause, reprise après un incident technique ;
- conclusion / synthèse.

CONTRAINTES (impératives) :
- "t" = une seconde ENTIÈRE, PRISE PARMI LES HORODATAGES [ ] fournis ci-dessous.
  ⛔ Aucun "t" en dehors de l'intervalle [${tr.debut}, ${tr.fin}] : tu ne vois que cet extrait.
- Environ ${attendues} rupture(s) attendue(s) sur cet extrait — n'en force pas davantage.
  Si l'extrait développe UN SEUL sujet du début à la fin, rends une liste VIDE : c'est une
  réponse juste et utile.${
    premiere
      ? `\n- Cet extrait OUVRE la séance : ajoute une entrée à t=${tr.debut} qui nomme le sujet d'ouverture.`
      : ''
  }
- "label" = un VRAI titre, de 3 à 8 mots, NOMINAL, en français, qui dit ce qu'on apprend
  (ex. « Les trois étapes de la digestion »).
  ⛔ Jamais une phrase recopiée de la transcription, jamais un fragment tronqué, jamais un
  titre qui commence par une conjonction ou un tic d'oral (et, mais, donc, alors, bref, euh…).
- "summary" = UNE phrase (160 caractères maximum) résumant ce qui se dit à partir de ce moment.
- Français. N'invente aucun sujet absent de l'extrait.

JSON attendu, strictement :
{"ruptures":[{"t":${tr.debut},"label":"…","summary":"…"}]}

EXTRAIT HORODATÉ (chaque ligne = « [seconde] texte ») :
"""
${tr.texte}
"""`;

    try {
      const brut = await this.askLlm(system, user, {
        // Modèle RAPIDE : c'est du repérage, pas de la rédaction fine — et 12 appels
        // sur un modèle à raisonnement feraient exploser le budget de temps.
        fast: true,
        // ⚠️ MESURÉ EN CONDITIONS RÉELLES (replay « L'arbre du Manikongo — 22 août »,
        // 3 h 44) : à 2000, CINQ des six premières tentatives MAP ont rendu un
        // `content` VIDE — HTTP 200, `finish_reason: "length"`, tout le budget
        // absorbé par le raisonnement interne du modèle avant le moindre caractère
        // de sortie. Conséquence à l'écran : une tranche entière morte (1:34→2:13)
        // et une autre tronquée, soit ~36 % du direct SANS aucun repère. Rejouée à
        // 6000, cette même tranche rend ses deux ruptures manquantes.
        // Ne pas redescendre ce plafond sans remesurer sur un vrai replay : le
        // symptôme n'est PAS une erreur, c'est un trou silencieux dans le sommaire.
        // 8000 et non 6000 : à 6000, une tranche sur six repartait encore vide et
        // devait être rejouée — un aller-retour perdu sur le chemin critique, alors
        // que le plafond ne coûte rien tant qu'il n'est pas consommé.
        maxTokens: 8000,
        timeoutMs: ReplayChaptersService.TIMEOUT_MAP_MS,
        echeance,
        etiquette: `MAP ${idx + 1}/${total}`,
      });
      // Le prompt ne fait que SUGGÉRER « environ N ruptures » : le modèle en rend
      // couramment le double. Sans plafond ici, rien ne borne la taille de l'index
      // du REDUCE — et c'est ce débordement qui provoquait sa troncature aveugle.
      const plafond = Math.max(
        ReplayChaptersService.MIN_RUPTURES_TRANCHE,
        attendues * ReplayChaptersService.TOLERANCE_RUPTURES,
      );
      return this.lireRuptures(brut, tr.debut, tr.fin, plafond);
    } catch (e) {
      // Une tranche perdue n'invalide pas le chapitrage : les autres couvrent le
      // reste de la durée, et le recouvrement limite la casse aux abords.
      this.logger.warn(`MAP ${idx + 1}/${total} abandonné : ${(e as Error).message}`);
      return [];
    }
  }

  /**
   * Lit et borne les ruptures rendues par UN appel MAP.
   *
   * `max` borne la SOURCE de l'index du REDUCE (voir le bloc « Bornage de l'index »).
   * Le surplus n'est PAS coupé en queue : il est échantillonné sur toute la fenêtre
   * de la tranche, donc la fin de la tranche reste représentée.
   */
  private lireRuptures(brut: any, debut: number, fin: number, max?: number): ReplayChapter[] {
    const liste: any[] = Array.isArray(brut?.ruptures)
      ? brut.ruptures
      : Array.isArray(brut?.chapters)
        ? brut.chapters
        : Array.isArray(brut?.chapitres)
          ? brut.chapitres
          : Array.isArray(brut)
            ? brut
            : [];

    const out: ReplayChapter[] = [];
    for (const it of liste) {
      const sec = ReplayChaptersService.lireSeconde(it?.t ?? it?.time ?? it?.start ?? it?.seconds);
      if (sec === null) continue;
      const t = Math.max(0, Math.round(sec));
      // Le modèle extrapole parfois au-delà de ce qu'il a lu. Une borne hors tranche
      // n'a été justifiée par AUCUN texte : on l'écarte (tolérance d'un bloc).
      if (t < debut - ReplayChaptersService.FENETRE_BLOC_SEC) continue;
      if (t > fin + ReplayChaptersService.FENETRE_BLOC_SEC) continue;
      // Titre gardé BRUT à ce stade : c'est le REDUCE qui harmonise. Le nettoyage
      // strict n'intervient qu'en sortie (valider / sélection déterministe).
      const label = String(it?.label ?? it?.title ?? it?.titre ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
      if (!label) continue;
      const summary = String(it?.summary ?? it?.resume ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160);
      out.push({ t, label, summary: summary || undefined });
    }
    if (max && out.length > max) {
      this.logger.warn(
        `MAP : ${out.length} rupture(s) rendues pour cette tranche (plafond ${max}) → ` +
          `échantillonnage réparti sur [${debut}, ${fin}] s.`,
      );
      return this.echantillonnerReparti(out, max, debut, fin);
    }
    return out.sort((a, b) => a.t - b.t);
  }

  // ── REDUCE : ruptures candidates → chapitres finaux ───────────────────────
  /**
   * Le REDUCE ne reçoit QUE la liste des ruptures candidates (quelques dizaines de
   * lignes, ≤ MAX_CANDIDATES_REDUCE) : c'est court, donc on peut se payer le modèle
   * de qualité et un vrai travail de jugement (fusion, hiérarchisation,
   * harmonisation des titres).
   *
   * ⚠️ Cet index est CHRONOLOGIQUE : toute réduction se fait sur le NOMBRE de
   * candidates, par échantillonnage réparti — jamais sur la longueur de la chaîne.
   * Voir le bloc « Bornage de l'index envoyé au REDUCE » en tête de classe.
   */
  private async reduireRuptures(
    candidats: ReplayChapter[],
    titre: string,
    dureeSec: number,
    bas: number,
    haut: number,
    echeance: number,
  ): Promise<any> {
    const system =
      "Tu es monteur pédagogique. Tu reçois la liste des RUPTURES DE SUJET repérées extrait par " +
      "extrait dans un cours donné en direct (les extraits se chevauchent : la même rupture peut " +
      'donc apparaître deux fois à quelques secondes d\'intervalle). Tu en fais le CHAPITRAGE ' +
      'définitif du replay. Tu réponds toujours en JSON strict.';

    // ⚠️ AUCUNE TRONCATURE SUR LES CARACTÈRES ICI (voir le bloc « Bornage de
    // l'index » en tête de classe) : la liste est chronologique, couper la chaîne
    // reviendrait à effacer la fin du direct. On borne le NOMBRE de candidates, par
    // échantillonnage réparti sur toute la durée.
    const retenus = this.echantillonnerReparti(
      candidats,
      ReplayChaptersService.MAX_CANDIDATES_REDUCE,
      0,
      dureeSec,
    );

    const index = retenus
      .map((c) => {
        // Résumé raccourci : il ne sert qu'au JUGEMENT du REDUCE (majeure /
        // mineure). Coupe sur une frontière de mot, et « … » signale au modèle que
        // la phrase est incomplète — donc qu'il ne doit pas la recopier telle
        // quelle (et si malgré tout il le fait, `restaurerResumes` rétablit
        // le résumé complet de la candidate côté serveur).
        const resume = ReplayChaptersService.resumeCourt(
          c.summary,
          ReplayChaptersService.RESUME_INDEX_CAR,
        );
        return `- t=${c.t} (${ReplayChaptersService.mmss(c.t)}) — ${c.label}${resume ? ` — ${resume}` : ''}`;
      })
      .join('\n');

    // Journalisation EXPLICITE de ce qui entre vs ce qui part : c'est l'absence de
    // ce log qui rendait la perte de la queue du direct totalement silencieuse.
    const derniere = retenus.length ? retenus[retenus.length - 1].t : 0;
    this.logger.log(
      `REDUCE : ${candidats.length} candidate(s) → ${retenus.length} envoyée(s), ` +
        `index ${index.length} car., dernière borne visible ${ReplayChaptersService.mmss(derniere)} ` +
        `sur ${ReplayChaptersService.mmss(dureeSec)}.`,
    );
    if (retenus.length < candidats.length) {
      this.logger.warn(
        `REDUCE : ${candidats.length - retenus.length} candidate(s) écartée(s) par ` +
          `échantillonnage réparti (plafond ${ReplayChaptersService.MAX_CANDIDATES_REDUCE}) — ` +
          'toute la durée reste couverte.',
      );
    }

    const user = `Séance : « ${titre || 'Session enregistrée'} » — durée ${Math.round(dureeSec / 60)} min (${dureeSec} secondes).

Voici toutes les ruptures candidates, dans l'ordre chronologique. Ton travail :

1. FUSIONNE les quasi-doublons : deux candidates séparées de moins de 150 secondes décrivent
   presque toujours LA MÊME rupture, vue depuis deux extraits qui se chevauchent. Garde la
   PLUS ANCIENNE des deux (le sujet commence là) et le meilleur des deux titres.
2. ÉCARTE les ruptures MINEURES : une parenthèse, un exemple isolé, une interruption technique
   ne méritent pas un chapitre. Ne garde que les vrais mouvements du cours.
3. HARMONISE les titres : même longueur, même style NOMINAL, même registre, en français.
   Un titre dit ce qu'on apprend (« Les trois provinces du Kongo »), jamais une phrase orale.
4. COUVRE TOUTE LA DURÉE : le premier chapitre commence au tout début de la séance ; les
   chapitres doivent être répartis jusqu'à la fin (${dureeSec} s), sans grand trou.

CONTRAINTES (impératives) :
- Produis entre ${bas} et ${haut} chapitres.
- "t" = secondes ENTIÈRES, strictement croissantes, CHOISIES PARMI les t candidates ci-dessous
  (n'invente aucune seconde). Le premier chapitre commence au tout début.
- Chaque chapitre dure AU MOINS 4 minutes (240 s) : ne pose pas deux bornes rapprochées.
- "label" = 3 à 8 mots, nominal. ⛔ Jamais un fragment recopié, jamais un titre commençant par
  une conjonction ou un tic d'oral (et, mais, donc, alors, bref, euh…).
- "summary" = UNE phrase (160 caractères maximum).
- Français. N'invente aucun sujet absent des candidates.

JSON attendu, strictement :
{"chapters":[{"t":0,"label":"…","summary":"…"}]}

RUPTURES CANDIDATES :
"""
${index}
"""`;

    // ⚠️ MODÈLE RAPIDE, ET C'EST DÉLIBÉRÉ (contre-intuitif pour une étape de synthèse).
    // Mesuré en conditions réelles sur ce prompt exact : `deepseek-v4-pro` ne rend
    // RIEN — vide à 3000 tokens, vide encore à 12 000 (12 000 tokens de raisonnement
    // brûlés, 133 s de mur, pour une entrée de 1 745 tokens seulement). Le chapitrage
    // qui a servi de preuve a en fait été produit par `deepseek-v4-flash` en 3ᵉ
    // tentative de repli : chaque run payait donc DEUX appels `pro` stériles
    // (~126 s des 203 s) avant d'être sauvé. L'entrée du REDUCE est courte et déjà
    // structurée (une liste de candidates) : le raisonnement lourd n'y apporte rien.
    // 9000 et non 6000 : mesuré, `flash` rend encore vide à 6000 sur ce prompt (tout
    // le budget part en raisonnement) et n'aboutit qu'à la 2ᵉ tentative, à 9000 —
    // une minute de perdue à chaque chapitrage pour rien. Le REDUCE peut d'ailleurs
    // rendre jusqu'à MAX_CHAPITRES entrées avec titre ET résumé : la sortie est plus
    // longue qu'il n'y paraît.
    return this.askLlm(system, user, {
      fast: true,
      maxTokens: 9000,
      timeoutMs: ReplayChaptersService.TIMEOUT_REDUCE_MS,
      echeance,
      etiquette: 'REDUCE',
    });
  }

  /**
   * REPLI DU REDUCE — on ne jette PAS le travail du MAP (c'est lui qui a coûté le
   * plus cher : jusqu'à 12 appels et plusieurs minutes). Si le REDUCE échoue, on
   * fabrique le chapitrage par un tri DÉTERMINISTE des ruptures candidates :
   * fusion des quasi-doublons du recouvrement, puis sélection de celles qui se
   * rapprochent le plus d'une répartition régulière sur la durée.
   *
   * Aucune borne n'est inventée : ce sont bien des ruptures repérées dans le texte,
   * d'où `source: 'ia'` conservé sur ce chemin.
   */
  private selectionDeterministe(
    candidats: ReplayChapter[],
    dureeSec: number,
    cible: number,
  ): ReplayChapter[] {
    // Ici le titre part TEL QUEL à l'écran (aucun REDUCE ne le réécrira) : on ne
    // retient donc que les candidates dont le titre survit au nettoyage.
    const nettoyes = candidats
      .map((c) => ({ ...c, label: this.nettoyerLabel(c.label) }))
      .filter((c) => c.label);
    if (nettoyes.length < 3) return [];

    const tries = [...nettoyes].sort((a, b) => a.t - b.t);
    const espaces: ReplayChapter[] = [];
    for (const c of tries) {
      const prec = espaces[espaces.length - 1];
      if (prec && c.t - prec.t < ReplayChaptersService.ECART_MIN_SEC) continue;
      espaces.push(c);
    }
    if (espaces.length <= cible) return espaces;

    // Trop de bornes : on garde celles qui tombent au plus près d'une répartition
    // régulière — critère purement déterministe (aucun aléa, résultat reproductible).
    const gardes: ReplayChapter[] = [];
    const pris = new Set<number>();
    for (let k = 0; k < cible; k += 1) {
      const viser = (dureeSec * k) / cible;
      let meilleur = -1;
      let dist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < espaces.length; i += 1) {
        if (pris.has(i)) continue;
        const d = Math.abs(espaces[i].t - viser);
        if (d < dist) {
          dist = d;
          meilleur = i;
        }
      }
      if (meilleur >= 0) {
        pris.add(meilleur);
        gardes.push(espaces[meilleur]);
      }
    }
    gardes.sort((a, b) => a.t - b.t);
    return gardes;
  }

  // ── Validation du retour du modèle ────────────────────────────────────────
  /** « 1:02:30 », « 12:30 », 750, « 750 » → 3750 / 750 / 750. `null` si illisible. */
  private static lireSeconde(v: unknown): number | null {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const s = String(v ?? '').trim();
    if (!s) return null;
    const direct = Number(s);
    if (Number.isFinite(direct)) return direct;
    // Le modèle renvoie parfois l'horodatage lisible malgré la consigne.
    const m = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }

  /** Secondes → « 1:02:30 » / « 12:30 », pour parler au modèle dans les deux langues. */
  private static mmss(sec: number): string {
    const s = Math.max(0, Math.round(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    const mm = h ? String(m).padStart(2, '0') : String(m);
    return `${h ? `${h}:` : ''}${mm}:${String(r).padStart(2, '0')}`;
  }

  /**
   * Raccourcit un résumé pour l'INDEX du REDUCE, sur une FRONTIÈRE DE MOT (jamais
   * « parce que vo »), avec « … » final pour dire au modèle que la phrase est
   * coupée. N'affecte que ce qui est ENVOYÉ : le résumé complet reste en mémoire
   * côté serveur (voir `restaurerResumes`).
   */
  private static resumeCourt(v: string | undefined, max: number): string {
    const s = String(v ?? '').replace(/\s+/g, ' ').trim();
    if (!s || s.length <= max) return s;
    return `${s.slice(0, max).replace(/\s+\S*$/, '').replace(/[.;,:…]+$/, '')}…`;
  }

  /**
   * Nettoie une étiquette RENDUE PAR LE MODÈLE et renvoie '' si ce n'est pas un
   * vrai titre. Voir le grand commentaire sur les filtres (famille B) : ce filtre
   * est volontairement plus souple que celui du repli local, parce qu'un titre
   * nominal commence très légitimement par « Ce que… », « Cette… », « Comment… »,
   * « Pourquoi… », « Quand… », « Où… ».
   */
  private nettoyerLabel(v: unknown): string {
    let s = String(v ?? '').replace(/\s+/g, ' ').trim();
    // Guillemets, puces et tirets décoratifs que le modèle ajoute parfois.
    s = s
      .replace(/^["'«»\-–—•*\s]+/, '')
      .replace(/["'«»\s]+$/, '')
      .replace(/[.;,:]+$/, '')
      .trim();
    if (!s) return '';
    if (s.length > 90) return ''; // titre-paragraphe = phrase recopiée, pas un titre

    const mots = s.split(/\s+/).filter(Boolean);
    if (!mots.length) return '';
    if (mots.length === 1) {
      // Un mot unique FORT est accepté (« Cosmogonie ») ; un mot unique vide non.
      const seul = mots[0].toLowerCase().replace(/[^\p{L}\p{N}'’-]/gu, '');
      if (seul.length < 4) return ''; // « Ok », « Ça », « Le »
      if (MOT_UNIQUE_VIDE.has(seul)) return ''; // « Partie », « Suite », « Intro »
    }

    if (DEBUT_TITRE_INTERDIT.test(s)) return ''; // conjonction / tic d'oral en tête
    if (mots.length > 1 && DEBUT_TITRE_PRONOM.test(s)) return ''; // « On voit que… », « C'est… »
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /**
   * VALIDATION SERVEUR — on ne fait jamais confiance au modèle : il renvoie
   * parfois des `t` en « mm:ss », des bornes au-delà de la fin, deux chapitres à
   * la même seconde, ou une phrase entière en guise de titre.
   */
  private valider(brut: any, dureeSec: number): ReplayChapter[] {
    const liste: any[] = Array.isArray(brut?.chapters)
      ? brut.chapters
      : Array.isArray(brut?.chapitres)
        ? brut.chapitres
        : Array.isArray(brut)
          ? brut
          : [];

    const propres: ReplayChapter[] = [];
    for (const it of liste) {
      const sec = ReplayChaptersService.lireSeconde(it?.t ?? it?.time ?? it?.start ?? it?.seconds);
      if (sec === null) continue;
      const t = Math.max(0, Math.round(sec));
      // Une borne au-delà de la fin (ou dans les 30 dernières secondes) est
      // inexploitable : elle ne mène nulle part dans le lecteur.
      if (dureeSec && t > dureeSec - 30) continue;
      const label = this.nettoyerLabel(it?.label ?? it?.title ?? it?.titre);
      if (!label) continue;
      const summary = String(it?.summary ?? it?.resume ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160);
      propres.push({ t, label, summary: summary || undefined });
    }

    propres.sort((a, b) => a.t - b.t);

    // Dédoublonnage + écart minimal (garde la PREMIÈRE borne d'un groupe serré).
    const espaces: ReplayChapter[] = [];
    for (const c of propres) {
      const prec = espaces[espaces.length - 1];
      if (prec && c.t - prec.t < ReplayChaptersService.ECART_MIN_SEC) continue;
      espaces.push(c);
    }

    // Le début du direct doit TOUJOURS appartenir à un chapitre, sinon le lecteur
    // n'en surligne aucun tant qu'on n'a pas atteint la première borne.
    //
    // ⚠️ PIÈGE CORRIGÉ : on réécrivait INCONDITIONNELLEMENT le premier chapitre
    // survivant à t = 0. Or `nettoyerLabel` peut avoir supprimé les chapitres qui le
    // précédaient. Scénario réellement démontré : le modèle rend
    //   [{t:0, "Ce que révèle la loi fondamentale"}, {t:1200, "Les trois provinces du Kongo"}]
    // → l'ancien filtre rejetait le premier (« ce » figurait dans ANAPHORES), et le
    // second héritait de t = 0 : les 20 PREMIÈRES MINUTES du replay se retrouvaient
    // étiquetées avec le titre d'un segment qui commence à 20 min. Faux à l'écran, et
    // faux au clic (le spectateur croit revoir le début, il tombe 20 min plus loin).
    // Désormais : on ne recale à 0 que si la première borne RETENUE est déjà proche
    // de 0 ; sinon on INSÈRE un chapitre d'ouverture honnête, qui n'affirme rien.
    const plafond = ReplayChaptersService.plafondChapitres(dureeSec);
    if (espaces.length) {
      if (espaces[0].t <= ReplayChaptersService.ECART_MIN_SEC) {
        espaces[0] = { ...espaces[0], t: 0 };
      } else {
        // Insérer alors qu'on est DÉJÀ au plafond ferait sauter le dernier chapitre
        // au `slice` ci-dessous — c'est-à-dire la FIN du direct, qui se retrouverait
        // sans repère. On sacrifie plutôt la borne la moins informative : celle qui
        // est la plus proche de sa voisine précédente (deux chapitres collés
        // apportent moins qu'une fin de séance couverte).
        if (espaces.length >= plafond) {
          let iPlusProche = 1;
          let ecartMin = Number.POSITIVE_INFINITY;
          for (let i = 1; i < espaces.length; i += 1) {
            const ecart = espaces[i].t - espaces[i - 1].t;
            if (ecart < ecartMin) {
              ecartMin = ecart;
              iPlusProche = i;
            }
          }
          espaces.splice(iPlusProche, 1);
        }
        espaces.unshift({ t: 0, label: 'Ouverture de la séance' });
      }
    }
    return espaces.slice(0, plafond);
  }

  /**
   * Rétablit le résumé COMPLET d'une candidate quand le chapitre final n'en a pas,
   * ou quand le modèle a recopié le résumé RACCOURCI de l'index (reconnaissable à
   * son « … » final).
   *
   * L'appariement se fait sur `t`, ce qui est sûr : le REDUCE a pour consigne de
   * choisir ses secondes PARMI les candidates. Une borne recalée à 0 par `valider`
   * ne trouve pas de candidate — on la laisse simplement telle quelle.
   */
  private restaurerResumes(
    chapitres: ReplayChapter[],
    candidats: ReplayChapter[],
  ): ReplayChapter[] {
    if (!chapitres.length || !candidats.length) return chapitres;
    const parSeconde = new Map<number, string>();
    for (const c of candidats) {
      // Première candidate gagnante : sur une zone de recouvrement, deux tranches
      // rendent la même seconde et l'ordre chronologique est déjà stabilisé.
      if (c.summary && !parSeconde.has(c.t)) parSeconde.set(c.t, c.summary);
    }
    return chapitres.map((ch) => {
      const complet = parSeconde.get(ch.t);
      if (!complet) return ch;
      if (!ch.summary || ch.summary.endsWith('…')) return { ...ch, summary: complet };
      return ch;
    });
  }

  // ── Repli local (aucune IA) ───────────────────────────────────────────────
  /**
   * REPLI SERVEUR, miroir EXACT de celui du lecteur (deriveChapters, dans
   * ImmersiveVideoPlayer) : les bornes tombent aux plus grands SILENCES (écart
   * entre deux cues consécutifs — les cues étant des paragraphes, un grand écart
   * signale une pause ou une fin de développement). L'étiquette est une phrase
   * COMPLÈTE ; à défaut « Partie N », plus honnête qu'un fragment illisible.
   *
   * ⚠️ PIÈGE CORRIGÉ (couverture) : un pas FIXE de 4 à 15 min plafonné à 14 repères
   * n'atteint jamais la fin d'un long direct — et comme la recherche retient le
   * PREMIER cue de plus grand écart, le pas réel tombait à son minimum (4 min) :
   * 13 sauts × 4 min = 52 min de repères pour 3 h 44 de vidéo, les 3/4 restants
   * sans aucun chapitre (et le dernier repère surligné pendant 1 h 30).
   * Le pas est donc RECALCULÉ à chaque tour depuis le temps restant et le nombre
   * de repères encore posables : la couverture s'auto-corrige, quelle que soit la
   * durée. Sur un direct très long, les chapitres dépassent forcément 15 min —
   * c'est la conséquence assumée du plafond de 14 entrées (au-delà, illisible).
   */
  private repli(cues: { t: number; text: string }[], dureeSec: number): ReplayChapter[] {
    const MIN = 240; // 4 min : en dessous, ce n'est plus un chapitre
    if (cues.length < 4 || !dureeSec) return [];

    // On ne chapitre que ce qui est TRANSCRIT : si les cues s'arrêtent à mi-parcours
    // (VTT partiel), poser des repères au-delà n'étiquetterait rien.
    const fin = Math.min(dureeSec, Math.round(cues[cues.length - 1].t) + 60);
    const plafond = ReplayChaptersService.plafondChapitres(fin);
    const bornes: number[] = [0];
    let courant = 0;
    while (courant + MIN < fin && bornes.length < plafond) {
      // Pas CIBLE : ce qu'il reste à couvrir, réparti sur les repères restants.
      const pas = Math.max(MIN, (fin - courant) / Math.max(1, plafond - bornes.length));
      const bas = courant + Math.max(MIN, pas * 0.6);
      const haut = Math.min(courant + pas * 1.4, fin);
      if (bas >= fin) break;
      let meilleur = -1;
      let meilleurEcart = -1;
      let meilleureDist = Infinity;
      for (let i = 1; i < cues.length; i += 1) {
        const t = cues[i].t;
        if (t < bas) continue;
        if (t > haut) break;
        const ecart = t - cues[i - 1].t; // proxy du silence précédant ce cue
        const dist = Math.abs(t - (courant + pas)); // écart au pas cible
        // À silence ÉGAL (débit régulier : le cas le plus fréquent), on prend le
        // candidat le plus proche du pas cible. Sans ce départage, le premier cue
        // de la fenêtre gagnait toujours et le pas s'écrasait sur son minimum.
        if (ecart > meilleurEcart || (ecart === meilleurEcart && dist < meilleureDist)) {
          meilleurEcart = ecart;
          meilleureDist = dist;
          meilleur = i;
        }
      }
      if (meilleur < 0) {
        // Aucun cue dans la fenêtre (blanc dans la transcription) : on avance.
        courant = haut;
        if (haut >= fin) break;
        continue;
      }
      courant = cues[meilleur].t;
      bornes.push(courant);
    }

    return bornes.map((t, i) => ({
      t: Math.round(t),
      label: this.etiquetteRepli(cues, t) || `Partie ${i + 1}`,
    }));
  }

  /**
   * Cherche, au voisinage de la borne, un cue qui commence VRAIMENT une phrase.
   * Deux passages : filtre strict d'abord (titre plausible), filtre souple ensuite
   * (phrase complète lisible) — puis seulement « Partie N » côté appelant.
   *
   * ⚠️ C'est ici — et NULLE PART AILLEURS — qu'on applique encore les filtres
   * stricts (famille A). C'est justifié : l'étiquette produite est une phrase
   * RECOPIÉE de la transcription, donc un fragment d'oral par construction. Les
   * titres du modèle, eux, passent par le filtre souple de `nettoyerLabel`.
   */
  private etiquetteRepli(cues: { t: number; text: string }[], t: number): string {
    let idx = cues.findIndex((c) => c.t >= t);
    if (idx < 0) idx = cues.length - 1;
    for (const filtre of [DEBUT_INTERDIT, DEBUT_INTERDIT_SOUPLE]) {
      for (const d of [0, 1, 2, -1, 3, -2]) {
        const i = idx + d;
        if (i < 0 || i >= cues.length) continue;
        const texte = String(cues[i].text || '').trim();
        const precedent = i > 0 ? String(cues[i - 1].text || '').trim() : '';
        // i === 0 : début du direct, pas de précédent à vérifier.
        if (i > 0 && !/[.!?…»]$/.test(precedent)) continue;
        const mots = texte.split(/\s+/).filter(Boolean);
        if (mots.length < 4) continue;
        if (filtre.test(texte)) continue;
        // Coupe la première phrase, puis sur une FRONTIÈRE DE MOT (jamais « parce que vo »).
        let phrase = texte.split(/[.!?…]/)[0].trim();
        if (phrase.length > 52) {
          phrase = `${phrase.slice(0, 52).replace(/\s+\S*$/, '')}…`;
        }
        if (phrase.split(/\s+/).filter(Boolean).length < 4) continue;
        return phrase.charAt(0).toUpperCase() + phrase.slice(1);
      }
    }
    return '';
  }

  // ── Orchestration ─────────────────────────────────────────────────────────
  /** Chapitrages en cours, par (tenant, replay). Voir le verrou dans `generate`. */
  private readonly enVol = new Map<string, Promise<ReplayChaptersResult>>();

  /**
   * Chapitre un replay publié du tenant. Idempotent par défaut : si des chapitres
   * existent déjà, on les renvoie sans rappeler le modèle (le chapitrage coûte des
   * jetons). `force: true` régénère.
   *
   * VERROU D'APPEL EN VOL : un chapitrage dure plusieurs minutes. Si un second
   * appel arrive pour le même replay pendant ce temps (le client a expiré et
   * l'utilisateur a recliqué, deux onglets, un traitement de lot…), il REJOINT le
   * run en cours au lieu d'en lancer un second — sinon on paie deux fois le même
   * travail. Conséquence assumée : un `force` qui arrive pendant un run non forcé
   * récupère le résultat de ce run ; il suffit de recliquer une fois terminé.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * ⏱️ PIRE CAS DE DURÉE (à tenir à jour : le timeout du client front doit rester
   *    SUPÉRIEUR — il est aujourd'hui à 780 000 ms, voir api-v2.ts
   *    `chaptersFromReplay`) :
   *
   *      lecture published_videos ................. ~1 s
   *      phase MAP (enveloppe DURE) ............... 360 s   ← BUDGET_MAP_MS
   *          (12 tranches, 3 en vol, 2 tentatives de 75 s chacune + backoffs ;
   *           chaque tentative est rognée sur l'échéance → jamais de dépassement)
   *      phase REDUCE ............................. 270 s   ← 3 tentatives × 90 s
   *      sélection déterministe / repli local ..... < 1 s   (pur calcul local)
   *      écriture published_videos ................ ~1 s
   *      ─────────────────────────────────────────────────
   *      TOTAL PIRE CAS ........................... ~633 s  (10 min 33 s)
   *
   *    Marge restante face au front : ~147 s (2 min 27 s). ✅ Le budget tient.
   *    Cas nominal observable (3 h 44 → 7 tranches, aucune erreur) : ~60 à 110 s.
   *
   *    ⚠️ Si l'on augmente MAX_TRANCHES, TIMEOUT_MAP_MS, BUDGET_MAP_MS ou
   *    TIMEOUT_REDUCE_MS, RECALCULER ce total ET remonter le timeout front dans le
   *    même mouvement : un front qui coupe un travail légitime affiche une erreur
   *    axios en anglais et laisse le bouton recliquable pendant que le run tourne
   *    toujours — donc un second appel modèle facturé pour rien.
   * ─────────────────────────────────────────────────────────────────────────
   */
  async generate(
    tenantId: string,
    videoId: string,
    opts?: { force?: boolean },
  ): Promise<ReplayChaptersResult> {
    if (!videoId) throw new BadRequestException('Identifiant de replay manquant.');
    const cle = `${tenantId}:${videoId}`;
    const enCours = this.enVol.get(cle);
    if (enCours) return enCours;
    const promesse = this.executer(tenantId, videoId, opts).finally(() => {
      // On ne supprime QUE sa propre entrée (un run suivant a pu prendre la place).
      if (this.enVol.get(cle) === promesse) this.enVol.delete(cle);
    });
    this.enVol.set(cle, promesse);
    return promesse;
  }

  private async executer(
    tenantId: string,
    videoId: string,
    opts?: { force?: boolean },
  ): Promise<ReplayChaptersResult> {
    // select('*') volontaire : la colonne `chapters` est récente (migration
    // hors-bande) — un select nominatif casserait sur une instance en retard.
    // CLOISON TENANT : le couple (id, tenant_id) est obligatoire.
    const { data: video } = await this.db
      .from('published_videos')
      .select('*')
      .eq('id', videoId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!video) throw new NotFoundException('Enregistrement introuvable.');

    // (b) Cache : on ne rappelle pas le modèle pour rien.
    const dejaLa = Array.isArray(video.chapters) ? (video.chapters as any[]) : [];
    if (dejaLa.length && !opts?.force) {
      return {
        chapters: dejaLa as ReplayChapter[],
        generated_at: video.chapters_generated_at || new Date().toISOString(),
        source: 'ia',
        persisted: true, // ils viennent de la base, par définition
      };
    }

    // (c) Sans transcription horodatée, aucun chapitrage n'est possible.
    const cues = (Array.isArray(video.transcript_cues) ? video.transcript_cues : [])
      .map((c: any) => ({ t: Number(c?.t), text: String(c?.text ?? '').trim() }))
      .filter((c: any) => Number.isFinite(c.t) && c.t >= 0 && c.text.length > 0)
      .sort((a: any, b: any) => a.t - b.t);
    if (cues.length < 4) {
      throw new BadRequestException(
        "Ce replay n'a pas encore de transcription horodatée. Le chapitrage sera possible dès qu'elle sera disponible.",
      );
    }

    // Durée : celle de la vidéo, sinon déduite du dernier cue.
    const dureeSec = Math.max(
      Number(video.duration_sec) || 0,
      Math.round(cues[cues.length - 1].t) + 60,
    );
    const dureeMin = Math.round(dureeSec / 60);
    const titre = String(video.title || 'Session enregistrée');

    // (d) Blocs 30 s (texte INTÉGRAL) → tranches avec recouvrement.
    const blocs = this.agreger(cues, ReplayChaptersService.FENETRE_BLOC_SEC);
    const { tranches, carTotal, resserre } = this.decouper(blocs);
    this.logger.log(
      `Chapitrage « ${titre} » : ${cues.length} cues, ${dureeMin} min → ${blocs.length} blocs de ` +
        `${ReplayChaptersService.FENETRE_BLOC_SEC} s → MAP en ${tranches.length} tranche(s), ` +
        `${carTotal} car. réellement envoyés (recouvrement ${ReplayChaptersService.RECOUVREMENT_SEC} s` +
        `${resserre ? ', ⚠️ garde-fou de resserrement ACTIF' : ''}).`,
    );

    // Calibrage du nombre de chapitres sur la durée réelle : une borne toutes les
    // ~12 min (cf. plafondChapitres — le 20 min précédent laissait 51 min de direct
    // sans repère alors que le MAP y avait trouvé de vraies ruptures). On laisse
    // une fourchette au modèle plutôt qu'un nombre exact : c'est le contenu qui
    // décide, pas l'horloge.
    const cible = ReplayChaptersService.plafondChapitres(dureeSec);
    const bas = Math.max(5, cible - 3);
    const haut = Math.min(ReplayChaptersService.MAX_CHAPITRES, cible + 3);

    // (e) MAP — concurrence bornée + enveloppe de temps DURE.
    const t0 = Date.now();
    const echeanceMap = t0 + ReplayChaptersService.BUDGET_MAP_MS;
    const lots = await this.enFlotte(
      tranches,
      ReplayChaptersService.CONCURRENCE_MAP,
      (tr, i) => this.mapTranche(tr, i, tranches.length, titre, echeanceMap),
    );
    const candidats: ReplayChapter[] = lots.flat();
    const tranchesUtiles = lots.filter((l) => l.length > 0).length;
    this.logger.log(
      `Chapitrage « ${titre} » : MAP terminé en ${Math.round((Date.now() - t0) / 1000)} s — ` +
        `${candidats.length} rupture(s) candidate(s) sur ${tranchesUtiles}/${tranches.length} tranche(s) productives.`,
    );

    // (f) REDUCE — court (il ne voit que les candidates), puis validation serveur.
    //     Tout échec descend d'un cran : REDUCE → sélection déterministe → repli local.
    let chapitres: ReplayChapter[] = [];
    if (candidats.length) {
      const echeanceReduce = Date.now() + ReplayChaptersService.TIMEOUT_REDUCE_MS * 3 + 5000;
      try {
        const brut = await this.reduireRuptures(candidats, titre, dureeSec, bas, haut, echeanceReduce);
        // Le REDUCE n'a vu que des résumés raccourcis : on rétablit ceux des
        // candidates quand il en a recopié un (ou n'en a rendu aucun).
        chapitres = this.restaurerResumes(this.valider(brut, dureeSec), candidats);
      } catch (e) {
        this.logger.warn(`REDUCE échoué (${video.id}) : ${(e as Error).message}`);
      }
      if (chapitres.length < 3) {
        // On ne perd PAS le travail du MAP : tri déterministe des candidates.
        const secours = this.selectionDeterministe(candidats, dureeSec, cible);
        const valides = secours.length ? this.valider({ chapters: secours }, dureeSec) : [];
        if (valides.length >= 3) {
          this.logger.warn(
            `Chapitrage « ${titre} » : REDUCE inexploitable → sélection déterministe des ` +
              `${valides.length} ruptures du MAP.`,
          );
          chapitres = valides;
        }
      }
    }

    if (chapitres.length < 3) {
      // Moins de 3 chapitres = liste ridicule (ou modèle indisponible) : on rend
      // le repli local. Il n'est PAS persisté, volontairement : persister un
      // résultat dégradé empoisonnerait le cache (b) et empêcherait un vrai
      // chapitrage plus tard sans `force`. Le lecteur sait de toute façon
      // dériver ces mêmes repères tout seul.
      const secours = this.repli(cues, dureeSec);
      if (!secours.length) {
        throw new ServiceUnavailableException(
          "Le chapitrage n'a rien produit d'exploitable pour ce replay (service IA indisponible).",
        );
      }
      this.logger.warn(
        `Chapitrage « ${titre} » : repli local (${secours.length} repères), non persisté.`,
      );
      return {
        chapters: secours,
        generated_at: new Date().toISOString(),
        source: 'repli',
        persisted: false,
      };
    }

    // (g) Persistance — les élèves liront ces chapitres sans rien déclencher.
    const generatedAt = new Date().toISOString();
    const { error } = await this.db
      .from('published_videos')
      .update({ chapters: chapitres, chapters_generated_at: generatedAt })
      .eq('id', videoId)
      .eq('tenant_id', tenantId);
    if (error) {
      // On ne perd pas le travail pour un souci d'écriture : le front affiche
      // les chapitres reçus, la persistance sera retentée au prochain appel.
      // Mais on le DIT (`persisted:false`) : sans écriture, les élèves ne verront
      // rien et chaque nouveau clic refacturera des jetons — annoncer un succès
      // complet serait un mensonge (colonne absente sur une instance en retard,
      // RLS, réseau…). Colonnes déclarées par la migration
      // supabase/migrations/20260725220000_published_videos_chapters.sql.
      this.logger.error(`Persistance des chapitres impossible (${videoId}) : ${error.message}`);
    }

    return {
      chapters: chapitres,
      generated_at: generatedAt,
      source: 'ia',
      persisted: !error,
    };
  }
}
