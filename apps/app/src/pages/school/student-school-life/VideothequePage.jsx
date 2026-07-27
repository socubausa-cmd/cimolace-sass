import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Search, Film, GraduationCap, FileText, Loader2, Sparkles, ListTree, Scissors } from 'lucide-react';
import { apiV2, masterclassApi, tenantsApi, videothequeApi } from '@/lib/api-v2';
import { exportCoursePdf } from '@/lib/exportCoursePdf';
import ImmersiveVideoPlayer from '@/components/school/formations/ImmersiveVideoPlayer';

// Palette LIRI (alignée sur /liri).
const C = {
  base: '#262624', panel: '#30302e', panel2: '#3a3a37', rail: '#1f1e1c',
  coral: '#d97757', ink: '#f5f4ee', muted: '#b0ada3', faint: '#82807a',
  line: 'rgba(245,244,238,.09)', coralTint: 'rgba(217,119,87,0.14)',
};
const SERIF = "'Source Serif 4', Georgia, serif";

const fmtDur = (sec) => {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
};

/**
 * VIDÉOTHÈQUE ÉLÈVE — les enregistrements (Zoom → R2, table `published_videos`) publiés pour le
 * tenant, visibles par les élèves du parcours. Lit `GET /zoom-engine/published` (tenant-scopé).
 * Clic → lecteur (playback_url) + description + (transcription quand disponible).
 */
export default function VideothequePage() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState(null); // null = chargement
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [active, setActive] = useState(null); // vidéo en lecture

  // ── Extraction du cours écrit (transcription → PDF structuré) ────────────
  // Réservé aux créateurs : l'analyse consomme des jetons IA (l'API renvoie 403
  // aux élèves de toute façon — on masque simplement le bouton pour eux).
  //
  // ⚠️ Le rôle NE VIT PAS dans la session Supabase (`user_metadata.role` est null
  // même pour l'owner) : il vit dans la MEMBERSHIP TENANT, côté serveur. On le
  // lit donc via /tenants/current (`userRole`), sinon le bouton restait masqué
  // pour tout le monde, y compris le propriétaire de l'école.
  //
  // ⚠️ DOUBLE ENVELOPPE : /tenants/current répond {data:{data:{…}}} alors que
  // `unwrap` n'en retire qu'une. On déballe donc une couche de plus si besoin.
  const [canExtract, setCanExtract] = useState(false);
  // Nom de l'ÉCOLE (tenant courant) — imprimé sur le PDF de cours. Cimolace est un
  // SaaS multi-tenant : coder « Prorascience » en dur (ce qui était le cas ici)
  // tamponnait le nom d'UN tenant sur les documents de TOUS les autres.
  const [tenantName, setTenantName] = useState('');
  useEffect(() => {
    let alive = true;
    tenantsApi.current()
      .then((res) => {
        const t = res?.userRole || res?.role ? res : (res?.data ?? res);
        const r = String(t?.userRole || t?.role || '').toLowerCase();
        if (!alive) return;
        setCanExtract(['owner', 'admin', 'teacher', 'creator'].includes(r));
        setTenantName(String(t?.name || t?.slug || '').trim());
      })
      .catch(() => { /* rôle inconnu → bouton masqué (le serveur reste seul juge) */ });
    return () => { alive = false; };
  }, []);
  const [extract, setExtract] = useState({ state: 'idle', message: '' });

  // ── Chapitrage IA du replay (vraies ruptures de sujet) ───────────────────
  // Sans lui, le lecteur ne montre que des REPÈRES dérivés des silences. Les
  // chapitres générés sont persistés côté API (published_videos.chapters) : les
  // élèves les liront ensuite sans jamais consommer de jetons.
  //
  // ⚠️ L'ÉTAT PORTE L'ID DE SA VIDÉO (`videoId`) : un message de chapitrage
  // n'appartient pas à l'écran, il appartient à UN replay. Sans cette étiquette,
  // ouvrir un autre replay pendant qu'un chapitrage tourne y affichait le message
  // du premier (« Chapitrage en cours… », bouton grisé) alors que rien n'était
  // lancé pour lui — et inversement.
  const [chapters, setChapters] = useState({ state: 'idle', message: '', videoId: null });
  // ⏱️ MINUTERIES ET COURSE DE REQUÊTES (bug facturé en jetons, corrigé ici).
  //   - `chapTimerRef` / `lotTimerRef` : les minuteries qui ramènent l'écran à
  //     l'état neutre après un succès/échec. Non annulées, une minuterie armée par
  //     un clic PRÉCÉDENT tirait pendant que la tentative suivante était encore en
  //     vol : l'état retombait à 'idle', le bouton se réactivait alors que le
  //     serveur travaillait, et le clic suivant refacturait un appel modèle.
  //   - `chapRunRef` : jeton de course. Seule la DERNIÈRE demande a le droit
  //     d'écrire l'état ; une réponse doublée par une plus récente est ignorée.
  //   - `activeIdRef` : identité de la vidéo ouverte, lue depuis la closure d'une
  //     requête longue (plusieurs minutes) — `active` y serait périmé.
  // Même écriture que `buildPollRef` (polling de construction) juste en dessous.
  const chapTimerRef = useRef(null);
  const chapRunRef = useRef(0);
  const lotTimerRef = useRef(null);
  const activeIdRef = useRef(null);
  useEffect(() => { activeIdRef.current = active?.id ?? null; }, [active]);
  // Au démontage on annule les minuteries ET on lève le drapeau d'arrêt du lot :
  // `handleChapitrerLot` est une boucle `async` que rien ne peut interrompre de
  // l'extérieur — elle ne teste que `lotStop.current`. Sans cette ligne, quitter la
  // Vidéothèque en plein traitement laissait la file continuer à enchaîner des
  // appels modèle facturés, sur un écran que plus personne ne regarde.
  useEffect(() => () => {
    clearTimeout(chapTimerRef.current);
    clearTimeout(lotTimerRef.current);
    lotStop.current = true;
  }, []);
  // Chapitrage EN LOT : la plainte d'origine porte sur TOUS les replays déjà
  // publiés. Les traiter un par un (ouvrir → onglet Chapitres → attendre ~5 min →
  // fermer → recommencer) sur des dizaines de sessions de 3 h n'est pas un
  // parcours : tant que ce n'est pas fait, les élèves continuent de voir le repli.
  // On enfile donc ici les replays non chapitrés, SÉQUENTIELLEMENT (un seul appel
  // modèle à la fois) et de façon interruptible.
  const [lot, setLot] = useState({ state: 'idle', fait: 0, total: 0, message: '' });
  const lotStop = useRef(false);

  // ── Construction d'un COURS ENSEIGNABLE depuis le replay ──────────────────
  // Traitement long (extraction → plan → leçons → publication) : l'API enregistre
  // une demande, le worker travaille, on suit l'avancement ici.
  const [build, setBuild] = useState({ state: 'idle', message: '', courseId: null });
  const buildPollRef = useRef(null);

  const followJob = useCallback((jobId) => {
    clearInterval(buildPollRef.current);
    buildPollRef.current = setInterval(async () => {
      try {
        const j = await masterclassApi.courseJob(jobId);
        if (j?.status === 'done') {
          clearInterval(buildPollRef.current);
          setBuild({ state: 'done', message: 'Cours prêt au poste production.', courseId: j.course_id });
        } else if (j?.status === 'failed') {
          clearInterval(buildPollRef.current);
          setBuild({ state: 'error', message: j.error_message || 'Construction impossible.', courseId: null });
        } else {
          setBuild({ state: 'working', message: j?.progress || 'Construction du cours…', courseId: null });
        }
      } catch { /* on retentera au prochain tour */ }
    }, 5000);
  }, []);

  useEffect(() => () => clearInterval(buildPollRef.current), []);

  async function handleBuildCourse(video) {
    if (!video?.id) return;
    setBuild({ state: 'working', message: 'Demande enregistrée…', courseId: null });
    try {
      const res = await masterclassApi.requestCourseFromReplay(video.id);
      const job = res?.job || res;
      if (!job?.id) throw new Error('Demande non enregistrée.');
      followJob(job.id);
    } catch (e) {
      const msg = String(e?.message || '');
      setBuild({
        state: 'error',
        courseId: null,
        message: /403|forbidden/i.test(msg) ? "Réservé aux enseignants et responsables de l'école." : (msg || 'Construction impossible.'),
      });
      setTimeout(() => setBuild({ state: 'idle', message: '', courseId: null }), 9000);
    }
  }

  // ── EXTRAITS COURTS (short_clips) fabriqués DEPUIS CE REPLAY ──────────────
  //
  // POURQUOI UNE DEMANDE EXPLICITE, ET PAS UN TRAITEMENT AUTOMATIQUE : le moteur
  // d'extraits sait faire (il a déjà produit un short depuis un direct), mais le
  // brancher en balayage sur toute la vidéothèque ferait retélécharger et
  // retranscrire des dizaines de replays de plusieurs heures — une dépense réelle
  // que personne n'a décidée. Ici c'est le créateur qui désigne LE replay.
  //
  // La fabrication vit côté worker (téléchargement R2 → transcription → découpe
  // ffmpeg → remontée R2) : l'API ne fait qu'ENREGISTRER la demande. On suit donc
  // l'avancement par sondage lent, exactement comme la construction de cours.
  //
  // ⚠️ L'ÉTAT DE VÉRITÉ EST PORTÉ PAR LA VIDÉO (`shorts_state` / `shorts_clips` /
  // `shorts_error`, posés par l'API sur chaque ligne), PAS par un état d'écran.
  // Même leçon que le chapitrage : un avancement appartient à UN replay. Rangé
  // dans la liste, fermer le lecteur ne le perd pas et la grille reste juste.
  // `extraits` ci-dessous ne porte que ce qui est purement d'interface : l'étape
  // d'armement (dire le coût en temps AVANT le clic) et l'échec de la demande.
  const [extraits, setExtraits] = useState({ videoId: null, arme: false, envoi: false, message: '' });
  const extraitsPollRef = useRef(null);
  const extraitsTimerRef = useRef(null);

  /** État des extraits d'une vidéo. Repli 'aucun' : les lignes servies avant cette
   *  fonctionnalité — et celles servies à un élève — ne portent pas ces champs. */
  const etatExtraits = (v) => ({
    state: v?.shorts_state || 'aucun',
    clips: Number(v?.shorts_clips || 0),
    erreur: String(v?.shorts_error || ''),
    // Replay sans transcription ET trop long pour être transcrit au vol : les
    // extraits sortiront NUS, et rien ne viendra y remédier tout seul. On le dit
    // avant le clic — c'est la différence entre « patienter » et « recliquer
    // chaque semaine pour le même résultat ».
    sansTranscription: Boolean(v?.shorts_sans_transcription),
  });

  /**
   * Range une réponse serveur DANS la vidéo ouverte ET dans la liste. Sans les
   * deux, refermer le lecteur reperdrait l'avancement jusqu'au rechargement, et
   * la pastille de la grille mentirait.
   */
  const patchExtraits = useCallback((videoId, s) => {
    const patch = {
      shorts_state: s?.state || 'aucun',
      shorts_clips: Number(s?.clips || 0),
      shorts_error: s?.error_message || '',
      shorts_sans_transcription: Boolean(s?.sans_transcription),
    };
    setActive((a) => (a && a.id === videoId ? { ...a, ...patch } : a));
    setVideos((prev) => (Array.isArray(prev) ? prev.map((v) => (v.id === videoId ? { ...v, ...patch } : v)) : prev));
  }, []);

  /**
   * Demande la fabrication pour LE replay ouvert. Le serveur est idempotent :
   * redemander pendant que le worker travaille ne relance rien — on affiche
   * simplement l'état qu'il renvoie.
   */
  async function handleDemanderExtraits(video) {
    if (!video?.id) return;
    clearTimeout(extraitsTimerRef.current);
    // ⚠️ ON RESTE « ARMÉ » PENDANT L'ENVOI. Repasser `arme` à faux dès le clic
    // faisait disparaître le bouton « Lancer » et réapparaître « Fabriquer des
    // extraits », CLIQUABLE, pendant que la requête était encore en vol : deux
    // demandes partaient pour le même replay. Le serveur est idempotent, mais
    // l'écran n'a aucune raison d'ouvrir cette fenêtre.
    setExtraits({ videoId: video.id, arme: true, envoi: true, message: '' });
    try {
      const s = await videothequeApi.requestShorts(video.id);
      patchExtraits(video.id, s);
      setExtraits({ videoId: null, arme: false, envoi: false, message: '' });
    } catch (e) {
      const msg = String(e?.message || '');
      setExtraits({
        videoId: video.id,
        arme: false,
        envoi: false,
        message: /403|forbidden/i.test(msg)
          ? "Réservé aux enseignants et responsables de l'école."
          : msg || 'Demande impossible.',
      });
      extraitsTimerRef.current = setTimeout(
        () => setExtraits({ videoId: null, arme: false, envoi: false, message: '' }),
        12000,
      );
    }
  }

  /**
   * Traduit un échec de chapitrage en français. Le cas du DÉLAI mérite son propre
   * message : axios rejette « timeout of 780000ms exceeded » (en anglais, dans une
   * UI française) alors que le serveur, lui, CONTINUE de travailler — dire
   * « impossible » serait faux et pousserait à recliquer pour rien.
   */
  function messageChapitrage(e) {
    const msg = String(e?.message || '');
    if (e?.code === 'ECONNABORTED' || /timeout/i.test(msg)) {
      return 'Le chapitrage prend plus de temps que prévu : il continue côté serveur. Rouvre ce replay dans quelques minutes.';
    }
    if (/403|forbidden/i.test(msg)) return "Réservé aux enseignants et responsables de l'école.";
    if (/transcription/i.test(msg)) return msg;
    return msg || 'Chapitrage impossible.';
  }

  /**
   * Chapitre UN replay et range le résultat dans l'état (vidéo ouverte + liste).
   * Renvoie le résultat brut pour que le traitement de lot puisse compter.
   * ⚠️ On mémorise aussi `chapters_source` : un repli SERVEUR (l'IA a échoué) ne
   * doit pas être présenté comme un vrai chapitrage dans le lecteur.
   *
   * `force` = REFAIRE le chapitrage même si des chapitres existent déjà en base.
   * Sans lui l'API renvoie son cache : c'est exactement ce qu'on veut au premier
   * passage (et pour le lot), jamais quand le créateur demande « Rechapitrer ».
   */
  async function chapitrer(video, force = false) {
    const res = await masterclassApi.chaptersFromReplay(video.id, force);
    const list = Array.isArray(res?.chapters) ? res.chapters : [];
    if (!list.length) throw new Error('Aucun chapitre exploitable.');
    const patch = { chapters: list, chapters_source: res?.source || 'ia', chapters_persisted: res?.persisted !== false };
    // ⚠️ UN REPLI N'ÉCRASE PAS UN VRAI CHAPITRAGE. Le serveur ne persiste jamais le
    // repli : si ce replay avait déjà des chapitres IA en base, ils y sont TOUJOURS
    // et les élèves continuent de les lire. Remplacer la copie locale par les
    // repères de secours peindrait ici un état dégradé qui n'existe nulle part
    // (carte « Repères provisoires », lecteur qui déclasse de vrais chapitres) —
    // le message d'échec suffit à dire que la re-génération n'a pas abouti.
    const replySeul = (res?.source || 'ia') === 'repli';
    const conserver = (v) => replySeul && Array.isArray(v?.chapters) && v.chapters.length > 0
      && v.chapters_source !== 'repli' && v.chapters_persisted !== false;
    // On injecte le résultat DANS la vidéo ouverte ET dans la liste : sans cela,
    // refermer le lecteur reperdrait les chapitres jusqu'au prochain chargement.
    setActive((a) => (a && a.id === video.id && !conserver(a) ? { ...a, ...patch } : a));
    setVideos((prev) => (Array.isArray(prev)
      ? prev.map((v) => (v.id === video.id && !conserver(v) ? { ...v, ...patch } : v))
      : prev));
    return { ...res, chapters: list };
  }

  /**
   * Chapitrage d'UN replay depuis le lecteur. `force` vient du bouton : « Chapitrer »
   * (premier passage) ne force pas, « Rechapitrer » force — sinon le clic se
   * contentait de réafficher le cache en annonçant une génération.
   */
  async function handleGenerateChapters(video, force = false) {
    if (!video?.id) return;
    // Une minuterie armée par un clic précédent tirerait EN PLEINE requête et
    // rouvrirait le bouton alors que le serveur travaille (→ double facturation).
    clearTimeout(chapTimerRef.current);
    const run = (chapRunRef.current += 1);
    setChapters({ state: 'working', message: 'Lecture de la transcription et repérage des ruptures de sujet…', videoId: video.id });
    // Une réponse est PÉRIMÉE si une demande plus récente l'a doublée, ou si
    // l'utilisateur a quitté ce replay entre-temps. Les données, elles, sont déjà
    // rangées par `chapitrer` : seul le message d'écran est abandonné. On ne
    // laisse toutefois pas l'état bloqué sur 'working' (bouton grisé à vie).
    const perime = () => {
      if (chapRunRef.current !== run) return true; // une autre demande possède l'état
      if (activeIdRef.current !== video.id) { setChapters({ state: 'idle', message: '', videoId: null }); return true; }
      return false;
    };
    try {
      const res = await chapitrer(video, force);
      if (perime()) return;
      const n = res.chapters.length;
      // `persisted:false` = les chapitres s'affichent ici mais ne sont PAS en base :
      // les élèves ne les verront pas et le prochain clic refacturera des jetons.
      const message = res?.source === 'repli'
        ? `${n} repères posés (chapitrage IA indisponible).`
        : res?.persisted === false
          ? `${n} chapitres générés, mais NON enregistrés : les élèves ne les verront pas encore.`
          : `${n} chapitres générés.`;
      setChapters({ state: res?.persisted === false ? 'error' : 'done', message, videoId: video.id });
      chapTimerRef.current = setTimeout(() => setChapters({ state: 'idle', message: '', videoId: null }), 9000);
    } catch (e) {
      if (perime()) return;
      setChapters({ state: 'error', message: messageChapitrage(e), videoId: video.id });
      chapTimerRef.current = setTimeout(() => setChapters({ state: 'idle', message: '', videoId: null }), 12000);
    }
  }

  /**
   * CHAPITRAGE EN LOT — enfile tous les replays non chapitrés qui disposent d'une
   * transcription horodatée. Séquentiel à dessein : un chapitrage mobilise un appel
   * modèle de plusieurs minutes ; les paralléliser saturerait le fournisseur et
   * ferait exploser la facture de jetons d'un coup. Interruptible à tout moment,
   * et chaque replay traité est immédiatement persisté côté API — arrêter en cours
   * de route ne perd rien de ce qui est déjà fait.
   */
  async function handleChapitrerLot() {
    const cibles = aChapitrer;
    if (!cibles.length || lot.state === 'working') return;
    // Même piège que pour le chapitrage unitaire : la minuterie du lot précédent
    // remettrait l'écran à zéro au milieu de celui-ci.
    clearTimeout(lotTimerRef.current);
    lotStop.current = false;
    setLot({ state: 'working', fait: 0, total: cibles.length, message: `0 / ${cibles.length}` });
    let ok = 0;
    let rates = 0;
    for (let i = 0; i < cibles.length; i += 1) {
      if (lotStop.current) break;
      setLot({ state: 'working', fait: i, total: cibles.length, message: `${i} / ${cibles.length} — « ${cibles[i].title || 'Session'} »…` });
      try {
        await chapitrer(cibles[i]);
        ok += 1;
      } catch {
        rates += 1; // un replay récalcitrant ne doit pas arrêter la file
      }
    }
    const arrete = lotStop.current;
    setLot({
      state: rates && !ok ? 'error' : 'done',
      fait: ok,
      total: cibles.length,
      message: `${ok} replay(s) chapitré(s)${rates ? `, ${rates} en échec` : ''}${arrete ? ' — arrêté' : ''}.`,
    });
    lotTimerRef.current = setTimeout(() => setLot({ state: 'idle', fait: 0, total: 0, message: '' }), 12000);
  }

  async function handleExtractCourse(video) {
    if (!video?.id) return;
    setExtract({ state: 'working', message: 'Analyse de la transcription…' });
    try {
      const course = await masterclassApi.fromReplay(video.id);
      if (!course?.modules?.length) throw new Error('Aucun contenu exploitable extrait.');
      setExtract({ state: 'working', message: 'Mise en page du document…' });
      // Nom RÉEL du tenant (repli neutre si le contexte n'a pas pu être lu) —
      // jamais un tenant en dur : la Vidéothèque sert toutes les écoles.
      await exportCoursePdf(course, { schoolName: tenantName || 'École' });
      const nbL = course.modules.reduce((a, m) => a + (m.lessons?.length || 0), 0);
      setExtract({ state: 'done', message: `Cours généré : ${course.modules.length} module(s), ${nbL} leçon(s).` });
      setTimeout(() => setExtract({ state: 'idle', message: '' }), 6000);
    } catch (e) {
      const msg = String(e?.message || '');
      setExtract({
        state: 'error',
        message: /403|forbidden/i.test(msg)
          ? "Réservé aux enseignants et responsables de l'école."
          : /transcription/i.test(msg)
            ? msg
            : msg || 'Extraction impossible.',
      });
      setTimeout(() => setExtract({ state: 'idle', message: '' }), 9000);
    }
  }

  // SONDAGE LENT de la fabrication en cours, uniquement pour le replay OUVERT et
  // uniquement tant qu'il y a quelque chose à attendre. 20 s : le travail se compte
  // en minutes, sonder plus vite ne ferait qu'ajouter du bruit réseau. Le sondage
  // s'arrête de lui-même dès que l'état est terminal ('pret' / 'erreur'), et
  // l'intervalle est nettoyé au changement de replay comme au démontage — un
  // intervalle oublié continuerait d'interroger l'API depuis un écran fermé.
  const etatActifExtraits = active ? etatExtraits(active) : null;
  useEffect(() => {
    clearInterval(extraitsPollRef.current);
    if (!active?.id || !canExtract) return undefined;
    const enCours = etatActifExtraits?.state === 'demande' || etatActifExtraits?.state === 'encours';
    if (!enCours) return undefined;
    const videoId = active.id;
    extraitsPollRef.current = setInterval(async () => {
      try {
        const s = await videothequeApi.shortsState(videoId);
        patchExtraits(videoId, s);
        if (s?.state === 'pret' || s?.state === 'erreur') clearInterval(extraitsPollRef.current);
      } catch { /* réseau capricieux : on retentera au prochain tour */ }
    }, 20000);
    return () => clearInterval(extraitsPollRef.current);
  }, [active?.id, etatActifExtraits?.state, canExtract, patchExtraits]);

  useEffect(() => () => {
    clearInterval(extraitsPollRef.current);
    clearTimeout(extraitsTimerRef.current);
  }, []);

  useEffect(() => {
    let alive = true;
    apiV2.get('/zoom-engine/published')
      .then((r) => { if (alive) setVideos(Array.isArray(r?.data?.data) ? r.data.data : (Array.isArray(r?.data) ? r.data : [])); })
      .catch((e) => { if (alive) { setVideos([]); setError(e?.message || 'Chargement impossible.'); } });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const list = Array.isArray(videos) ? videos : [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((v) => String(v.title || '').toLowerCase().includes(term) || String(v.description || '').toLowerCase().includes(term));
  }, [videos, q]);

  /**
   * ÉTAT DE CHAPITRAGE d'un replay, du seul point de vue qui compte : celui de
   * l'ÉLÈVE, qui ne voit que ce qui est EN BASE.
   *   'ia'      → vrai chapitrage sémantique persisté : les élèves le liront ;
   *   'repli'   → repères heuristiques renvoyés par le serveur quand l'IA a échoué.
   *               Le service ne les persiste JAMAIS (replay-chapters.service.ts :
   *               « il n'est PAS persisté, volontairement ») : compter ce replay
   *               comme « chapitré » était donc doublement faux — l'élève n'en verra
   *               rien, et le replay disparaissait de la file de chapitrage en lot ;
   *   'volatil' → vrais chapitres mais écriture en base en échec (persisted:false) ;
   *   'aucun'   → jamais chapitré.
   * ⚠️ `chapters_source` / `chapters_persisted` n'existent PAS en base (aucune
   * colonne) : ils ne sont posés que par `chapitrer()` sur la copie locale. Une
   * vidéo qui arrive du serveur avec des chapitres vient donc forcément du cache
   * IA persisté → 'ia'. C'est exactement ce qu'on veut.
   */
  const etatChapitrage = (v) => {
    if (!Array.isArray(v?.chapters) || v.chapters.length === 0) return 'aucun';
    if (v.chapters_source === 'repli') return 'repli';
    if (v.chapters_persisted === false) return 'volatil';
    return 'ia';
  };
  // Un replay est CHAPITRABLE s'il n'a pas déjà de chapitres ET s'il a une
  // transcription horodatée (sans elle l'API répond 400 : rien à lire).
  const estChapitre = (v) => etatChapitrage(v) === 'ia';
  const aChapitrer = useMemo(
    () => (Array.isArray(videos) ? videos : []).filter(
      (v) => !estChapitre(v) && Array.isArray(v.transcript_cues) && v.transcript_cues.length >= 4,
    ),
    [videos],
  );

  // ── Ce que l'en-tête du lecteur doit dire des EXTRAITS, en un seul endroit ──
  // Calculé ici plutôt qu'en ligne dans le JSX : la bande d'actions du lecteur est
  // déjà dense (PDF, cours, précepteur) et un troisième bloc ternaire imbriqué y
  // deviendrait illisible.
  const exActif = active
    ? etatExtraits(active)
    : { state: 'aucun', clips: 0, erreur: '', sansTranscription: false };
  const exArme = Boolean(active && extraits.videoId === active.id && extraits.arme);
  const exEnvoi = Boolean(active && extraits.videoId === active.id && extraits.envoi);
  const exEchec = active && extraits.videoId === active.id ? extraits.message : '';
  const exTravaille = exActif.state === 'demande' || exActif.state === 'encours';
  // Accord en nombre : « 1 extrait prêt » / « 3 extraits prêts ».
  const exPluriel = exActif.clips > 1 ? 's' : '';
  const exTexte = exEchec
    || (exArme
      // HONNÊTETÉ AVANT LE CLIC : la fabrication n'est pas instantanée, elle ne
      // publie rien, et sur certains replays elle ne peut PAS sous-titrer. Dire les
      // trois ici évite trois déceptions — attendre devant un écran qui ne bouge
      // pas, croire que les réseaux sont servis, et surtout relancer indéfiniment
      // en espérant des sous-titres qui ne viendront jamais tout seuls.
      ? (exActif.sansTranscription
        ? 'Ce replay n’a pas de transcription et il est trop long pour être transcrit au vol : les extraits sortiront SANS sous-titres, et relancer n’y changera rien. Comptez plusieurs minutes de découpe. Rien n’est publié sur les réseaux — les extraits vous attendront au Créateur de publicités.'
        : 'Téléchargement du replay, transcription puis découpe : comptez plusieurs minutes. Rien n’est publié sur les réseaux — les extraits vous attendront au Créateur de publicités.')
      : exActif.state === 'demande'
        ? 'Demande enregistrée : la fabrication démarre d’ici quelques minutes.'
        : exActif.state === 'encours'
          ? 'Découpage en cours… comptez plusieurs minutes.'
          : exActif.state === 'pret'
            ? (exActif.clips > 0
              ? `${exActif.clips} extrait${exPluriel} prêt${exPluriel} — Studio › Créateur de publicités.`
              : 'Aucun passage exploitable : ce replay n’a produit aucun extrait.')
            : exActif.state === 'erreur'
              ? `Échec : ${exActif.erreur || 'motif non communiqué par le moteur'}.`
              : '');
  // Vert = un résultat réellement livré. Corail = un échec. Neutre partout ailleurs,
  // y compris pour un « terminé sans extrait » qui n'est ni l'un ni l'autre.
  // ⚠️ L'ARMEMENT NEUTRALISE LA COULEUR : après un échec, « Relancer » affiche la
  // phrase d'avertissement — la peindre en corail donnerait à lire un nouvel échec
  // là où on explique simplement ce qui va se passer.
  const exSucces = !exArme && exActif.state === 'pret' && exActif.clips > 0 && !exEchec;
  const exErreur = Boolean(exEchec) || (!exArme && exActif.state === 'erreur');

  return (
    <div style={{ minHeight: 'calc(100vh - 120px)', background: C.base, color: C.ink, fontFamily: "'Inter', system-ui, sans-serif", padding: '18px 20px 48px' }}>
      {/* Lecteur immersif plein-écran */}
      {active && (
        <ImmersiveVideoPlayer
          src={active.playback_url}
          title={active.title}
          description={active.description}
          crumb={{ module: active.category }}
          cues={Array.isArray(active.transcript_cues) ? active.transcript_cues : undefined}
          transcript={active.transcript_text || active.transcript}
          // Chapitrage IA persisté (published_videos.chapters) ; absent → le lecteur
          // dérive ses propres repères des silences de la transcription.
          chapters={Array.isArray(active.chapters) ? active.chapters : undefined}
          // Origine réelle : un repli SERVEUR (IA en échec) reste annoncé comme
          // « repères automatiques » dans le lecteur — sinon un résultat dégradé
          // passait pour un vrai chapitrage dès qu'on l'injectait ici.
          chaptersSource={active.chapters_source}
          // Le bouton de chapitrage n'est proposé qu'aux créateurs (jetons IA).
          // Le lecteur passe `force` : vrai quand il affiche « Rechapitrer » (des
          // chapitres IA existent déjà), faux au premier chapitrage. Sans ce
          // paramètre, « Rechapitrer » ne faisait que relire le cache serveur.
          onGenerateChapters={canExtract ? (force) => handleGenerateChapters(active, force === true) : undefined}
          // L'état de chapitrage appartient à UNE vidéo : si le message concerne un
          // autre replay (chapitrage lancé puis navigation), ce lecteur-ci repart
          // d'un état neutre au lieu d'hériter d'un « en cours » qui n'est pas le sien.
          chaptersState={chapters.videoId === active.id ? chapters : { state: 'idle', message: '' }}
          onExit={() => setActive(null)}
          headerAction={(
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {/* Message d'état de l'extraction (analyse longue → on informe) */}
              {extract.state !== 'idle' && (
                <span style={{
                  fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', padding: '6px 10px', borderRadius: 999,
                  color: extract.state === 'error' ? '#f6b8ab' : extract.state === 'done' ? '#c9dcbf' : C.muted,
                  background: extract.state === 'error' ? 'rgba(217,119,87,.14)' : extract.state === 'done' ? 'rgba(159,191,143,.14)' : 'rgba(255,255,255,.05)',
                }}>
                  {extract.message}
                </span>
              )}
              {canExtract && (
                <button
                  type="button"
                  onClick={() => handleExtractCourse(active)}
                  disabled={extract.state === 'working'}
                  title="Transformer la transcription de ce direct en document de cours structuré (PDF)"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999,
                    border: `1px solid ${C.line}`, background: 'rgba(255,255,255,.05)', color: C.ink,
                    cursor: extract.state === 'working' ? 'wait' : 'pointer', fontSize: 12.5, fontWeight: 700,
                    whiteSpace: 'nowrap', opacity: extract.state === 'working' ? 0.7 : 1,
                  }}
                >
                  {extract.state === 'working'
                    ? <Loader2 size={14} className="animate-spin" />
                    : <FileText size={14} />}
                  {extract.state === 'working' ? 'Extraction…' : 'Extraire le cours (PDF)'}
                </button>
              )}
              {/* Construction du cours enseignable (worker) + suivi d'avancement */}
              {build.state !== 'idle' && (
                <span style={{
                  fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', padding: '6px 10px', borderRadius: 999,
                  color: build.state === 'error' ? '#f6b8ab' : build.state === 'done' ? '#c9dcbf' : C.muted,
                  background: build.state === 'error' ? 'rgba(217,119,87,.14)' : build.state === 'done' ? 'rgba(159,191,143,.14)' : 'rgba(255,255,255,.05)',
                }}>
                  {build.message}
                </span>
              )}
              {build.state === 'done' && build.courseId ? (
                <button type="button" onClick={() => navigate(`/studio/formation?editFormationId=${build.courseId}`)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, border: `1px solid ${C.coral}`, background: C.coralTint, color: '#f0c3ac', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  <GraduationCap size={14} /> Ouvrir le cours
                </button>
              ) : canExtract && (
                <button
                  type="button"
                  onClick={() => handleBuildCourse(active)}
                  disabled={build.state === 'working'}
                  title="Reconstruire cette séance en cours enseignable pour débutants (plan, leçons, schémas, quiz) — déposé en brouillon au poste production"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999,
                    border: `1px solid ${C.coral}`, background: C.coralTint, color: '#f0c3ac',
                    cursor: build.state === 'working' ? 'wait' : 'pointer', fontSize: 12.5, fontWeight: 700,
                    whiteSpace: 'nowrap', opacity: build.state === 'working' ? 0.7 : 1,
                  }}
                >
                  {build.state === 'working' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {build.state === 'working' ? 'Construction…' : 'Construire le cours'}
                </button>
              )}
              {/* ── EXTRAITS COURTS depuis CE replay (créateurs) ─────────────────
                  Deux temps volontaires : « Fabriquer des extraits » ARME la
                  demande et affiche ce qu'elle coûte en temps ; « Lancer » seul
                  l'envoie. Un traitement de plusieurs minutes ne se déclenche pas
                  d'un clic distrait. Une fois lancé, plus de bouton : l'état parle. */}
              {canExtract && exTexte ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 11.5, fontWeight: 600, padding: '6px 10px', borderRadius: 999,
                  maxWidth: exArme ? 340 : undefined,
                  whiteSpace: exArme ? 'normal' : 'nowrap', lineHeight: 1.45, textAlign: 'left',
                  color: exErreur ? '#f6b8ab' : exSucces ? '#c9dcbf' : C.muted,
                  background: exErreur ? 'rgba(217,119,87,.14)' : exSucces ? 'rgba(159,191,143,.14)' : 'rgba(255,255,255,.05)',
                }}>
                  {exTravaille && !exEchec ? <Loader2 size={12} className="animate-spin" style={{ flexShrink: 0 }} /> : null}
                  {exTexte}
                </span>
              ) : null}
              {canExtract && exArme ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleDemanderExtraits(active)}
                    disabled={exEnvoi}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999,
                      border: `1px solid ${C.coral}`, background: C.coralTint, color: '#f0c3ac',
                      cursor: exEnvoi ? 'wait' : 'pointer', fontSize: 12.5, fontWeight: 700,
                      whiteSpace: 'nowrap', opacity: exEnvoi ? 0.7 : 1,
                    }}
                  >
                    {exEnvoi ? <Loader2 size={14} className="animate-spin" /> : <Scissors size={14} />}
                    {exEnvoi ? 'Envoi…' : 'Lancer la fabrication'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtraits({ videoId: null, arme: false, envoi: false, message: '' })}
                    style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 14px', borderRadius: 999, border: `1px solid ${C.line}`, background: 'rgba(255,255,255,.05)', color: C.ink, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}
                  >
                    Annuler
                  </button>
                </>
              ) : canExtract && exTravaille ? null
                : canExtract && exActif.state === 'pret' && exActif.clips > 0 ? (
                  <button
                    type="button"
                    onClick={() => navigate('/studio/ad-creator')}
                    title="Ouvrir le Créateur de publicités : les extraits prêts s'y choisissent à l'étape de publication"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, border: `1px solid ${C.coral}`, background: C.coralTint, color: '#f0c3ac', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}
                  >
                    <Film size={14} /> Voir les extraits
                  </button>
                ) : canExtract ? (
                  <button
                    type="button"
                    onClick={() => setExtraits({ videoId: active.id, arme: true, envoi: false, message: '' })}
                    // ⚠️ NE PAS PROMETTRE « sous-titrés » TOUT COURT. L'incrustation
                    // dépend d'une transcription (absente sur les replays longs jamais
                    // transcrits) ET du filtre `subtitles` de ffmpeg côté worker. Le
                    // texte armé, lui, dit précisément ce qu'il en sera pour CE replay.
                    title="Découper ce replay en extraits verticaux — sous-titres incrustés quand une transcription existe. Traitement long (plusieurs minutes), sans aucune publication automatique"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999,
                      border: `1px solid ${C.line}`, background: 'rgba(255,255,255,.05)', color: C.ink,
                      cursor: 'pointer', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
                    }}
                  >
                    <Scissors size={14} />
                    {exActif.state === 'aucun' ? 'Fabriquer des extraits' : 'Relancer la fabrication'}
                  </button>
                ) : null}
              {active.precepteur_id ? (
                <button type="button" onClick={() => navigate(`/liri/precepteur/cours/${active.precepteur_id}`)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, border: `1px solid ${C.coral}`, background: C.coralTint, color: '#f0c3ac', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  <GraduationCap size={14} /> Suivre le cours
                </button>
              ) : null}
            </div>
          )}
        />
      )}

      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(24px,3vw,32px)', fontWeight: 600, margin: 0 }}>Vidéothèque</h1>
            <p style={{ color: C.muted, fontSize: 13.5, margin: '4px 0 0' }}>Revois les sessions de cours enregistrées, quand tu veux.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* CHAPITRAGE EN LOT (créateurs) — sans lui, remettre à niveau une
                vidéothèque entière se fait replay par replay, à la main. */}
            {canExtract && (aChapitrer.length > 0 || lot.state !== 'idle') && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {lot.message ? (
                  <span style={{
                    fontSize: 11.5, fontWeight: 600, padding: '6px 10px', borderRadius: 999,
                    color: lot.state === 'error' ? '#f6b8ab' : lot.state === 'done' ? '#c9dcbf' : C.muted,
                    background: lot.state === 'error' ? 'rgba(217,119,87,.14)' : lot.state === 'done' ? 'rgba(159,191,143,.14)' : 'rgba(255,255,255,.05)',
                  }}>
                    {lot.message}
                  </span>
                ) : null}
                {lot.state === 'working' ? (
                  <button type="button" onClick={() => { lotStop.current = true; }}
                    title="Terminer le replay en cours puis s'arrêter (rien n'est perdu : chaque replay est enregistré au fil de l'eau)"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, border: `1px solid ${C.line}`, background: 'rgba(255,255,255,.05)', color: C.ink, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    <Loader2 size={14} className="animate-spin" /> Arrêter
                  </button>
                ) : (
                  <button type="button" onClick={handleChapitrerLot} disabled={!aChapitrer.length}
                    title="Chapitrer avec l'IA tous les replays qui ne le sont pas encore, l'un après l'autre"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, border: `1px solid ${C.coral}`, background: C.coralTint, color: '#f0c3ac', cursor: aChapitrer.length ? 'pointer' : 'default', opacity: aChapitrer.length ? 1 : 0.5, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    <ListTree size={14} /> Chapitrer les {aChapitrer.length} replays non chapitrés
                  </button>
                )}
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: C.faint }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…"
                style={{ paddingLeft: 34, paddingRight: 14, height: 38, borderRadius: 12, border: `1px solid ${C.line}`, background: C.panel, color: C.ink, fontSize: 13.5, outline: 'none', width: 240 }} />
            </div>
          </div>
        </div>

        {videos === null ? (
          <p style={{ color: C.faint, textAlign: 'center', padding: '60px 0' }}>Chargement…</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
            <Film size={30} style={{ color: C.faint, marginBottom: 10 }} />
            <p style={{ fontSize: 15 }}>{q ? 'Aucun résultat.' : 'Aucun enregistrement publié pour le moment.'}</p>
            {error ? <p style={{ fontSize: 12.5, color: C.faint, marginTop: 6 }}>{error}</p> : null}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {filtered.map((v) => (
              <button key={v.id} type="button" onClick={() => setActive(v)}
                style={{ textAlign: 'left', padding: 0, borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.line}`, background: C.panel, cursor: 'pointer', color: C.ink }}>
                <div style={{ position: 'relative', aspectRatio: '16/9', background: C.panel2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {v.thumbnail_url ? <img src={v.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Film size={26} style={{ color: C.faint }} />}
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.18)' }}>
                    <span style={{ width: 44, height: 44, borderRadius: 22, background: C.coralTint, border: `1px solid ${C.coral}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Play size={18} style={{ color: C.coral, marginLeft: 2 }} />
                    </span>
                  </span>
                  {v.duration_sec ? <span style={{ position: 'absolute', right: 8, bottom: 8, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: 'rgba(0,0,0,.6)', color: '#fff' }}>{fmtDur(v.duration_sec)}</span> : null}
                  {v.precepteur_id ? <span style={{ position: 'absolute', left: 8, top: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'rgba(217,119,87,.92)', color: '#fff' }}><GraduationCap size={11} /> Cours</span> : null}
                </div>
                <div style={{ padding: '11px 13px 14px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.title || 'Cours enregistré'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 5 }}>
                    {v.category ? <span style={{ fontSize: 11.5, color: C.faint }}>{v.category}</span> : null}
                    {/* État de chapitrage : lisible d'un coup d'œil sur toute la
                        vidéothèque. Seul un chapitrage IA PERSISTÉ porte le badge
                        doré : un repli (jamais enregistré) ou une écriture en base
                        ratée sont dits pour ce qu'ils sont, sinon la vidéothèque
                        annonçait « chapitré » ce que l'élève ne verrait jamais.
                        Ces mentions n'intéressent que le créateur — pour l'élève,
                        c'est du bruit sur lequel il ne peut rien. */}
                    {estChapitre(v) ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'rgba(230,204,146,.13)', color: '#e6cc92' }}>
                        <ListTree size={11} /> {v.chapters.length} chapitres
                      </span>
                    ) : canExtract ? (
                      // C.muted et non C.faint : à 10,5 px, C.faint tombe à 2,7:1 sur
                      // ce fond (norme WCAG : 4,5:1) — illisible pour l'œil qu'il vise.
                      <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: 'rgba(255,255,255,.05)', color: C.muted }}>
                        {etatChapitrage(v) === 'repli'
                          ? 'Repères provisoires'
                          : etatChapitrage(v) === 'volatil'
                            ? 'Chapitres non enregistrés'
                            : 'Non chapitré'}
                      </span>
                    ) : null}
                    {/* État des EXTRAITS, d'un coup d'œil sur toute la vidéothèque.
                        Affiché UNIQUEMENT quand quelque chose a été demandé : la
                        très grande majorité des replays n'a rien à dire ici, et une
                        pastille « aucun extrait » sur chacun ne serait que du bruit
                        (le chapitrage occupe déjà cette ligne). */}
                    {canExtract && v.shorts_state && v.shorts_state !== 'aucun' ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700,
                        padding: '2px 7px', borderRadius: 999,
                        color: v.shorts_state === 'pret' && Number(v.shorts_clips) > 0 ? '#f0c3ac' : C.muted,
                        background: v.shorts_state === 'pret' && Number(v.shorts_clips) > 0 ? C.coralTint : 'rgba(255,255,255,.05)',
                      }}>
                        <Scissors size={11} />
                        {v.shorts_state === 'pret'
                          ? (Number(v.shorts_clips) > 0
                            ? `${v.shorts_clips} extrait${Number(v.shorts_clips) > 1 ? 's' : ''}`
                            : 'Aucun extrait')
                          : v.shorts_state === 'erreur'
                            ? 'Extraits en échec'
                            : v.shorts_state === 'encours'
                              ? 'Extraits en cours'
                              : 'Extraits demandés'}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
