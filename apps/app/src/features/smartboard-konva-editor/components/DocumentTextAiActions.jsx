/**
 * DocumentTextAiActions — commandes IA du panneau Texte (Reformuler, Améliorer, …).
 *
 * Remplace six boutons décoratifs : le composant `AiBtn` de StudioSmartboardKonvaPage
 * rendait un <button> SANS `onClick`, le clic était absorbé sans message ni erreur.
 *
 * ⛔ RÈGLE : aucun remplacement silencieux. Le modèle PROPOSE (2 à 4 variantes),
 * l'utilisateur choisit, relit l'avant/après, puis valide. L'application se fait par
 * PATCH — `updateObject(id, { content: { text } })` — jamais par reconstruction de
 * l'objet, jamais sans clic explicite.
 *
 * Le moteur est `documentIntelligence.js` ; ce composant n'appelle aucune edge
 * function directement et respecte le verrou « contrôle libre » du moteur.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Sparkles, Loader2, Check, X, RotateCcw, Languages, BookMarked, SpellCheck2, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDocumentCoachStore } from '@/features/smartboard-konva-editor/store/useDocumentCoachStore';
import {
  analyserContexteLocal,
  corrigerFautes,
  suggererFormulation,
  suggererMotTechnique,
} from '@/features/smartboard-konva-editor/lib/documentIntelligence';
/* `appliquerCorrections` vient du moteur, pas d'un remplacement maison : lui seul
   revérifie que la chaîne fautive est encore là avant d'écrire. */
import {
  appliquerCorrections,
  TYPES_CORRECTION,
} from '@/features/smartboard-konva-editor/lib/documentCorrection';
/* Le mode vient du store (réactif) : `lireModeAssistance()` est un verrou de module,
   il ne redéclenche aucun rendu React quand l'utilisateur change de mode. */
import { useDocumentAiModeStore } from '@/features/smartboard-konva-editor/components/DocumentSuggestionsPanel';

/** Chaque intention devient une consigne réelle envoyée au moteur. */
const TEXT_ACTIONS = [
  { id: 'reformuler', label: 'Reformuler', sub: 'Réécriture naturelle', intention: null },
  { id: 'ameliorer',  label: 'Améliorer',  sub: 'Style et clarté',      intention: 'style plus clair et plus fluide, sans changer la longueur' },
  { id: 'resumer',    label: 'Résumer',    sub: 'Version plus courte',  intention: 'version nettement plus courte, tous les faits conservés' },
  { id: 'developper', label: 'Développer', sub: 'Enrichir le contenu',  intention: 'version développée : précisions utiles uniquement, aucun fait inventé' },
  { id: 'simplifier', label: 'Simplifier', sub: 'Langage accessible',   intention: 'phrases courtes, vocabulaire accessible, aucune perte d\'information' },
];

const LANGUAGES = ['Anglais', 'Arabe', 'Espagnol', 'Portugais', 'Lingala'];

/**
 * Fautes à relire, dans l'ordre du texte.
 * `suggestionsStyle` est volontairement laissé de côté : le bouton s'appelle
 * « Corriger les fautes », pas « réécrire le style » — Reformuler s'en charge déjà.
 *
 * @param {any} res sortie de `corriger`
 */
function fautesARelire(res) {
  const brut = Array.isArray(res?.corrections) ? res.corrections : [];
  return brut.filter((c) => c && c.avant && typeof c.apres === 'string' && c.avant !== c.apres);
}

const accord = (n) => (n > 1 ? 's' : '');

const libelleType = (t) => TYPES_CORRECTION?.[t]?.label ?? String(t ?? '');

/**
 * Aperçu avant / après — le seul chemin d'application d'un texte produit par le modèle.
 * @param {{
 *   before: string, after: string, title: string, busy?: boolean,
 *   onApply: () => void, onRegenerate?: () => void, onCancel: () => void, applyLabel?: string,
 * }} props
 */
export function TextDiffPreview({ before, after, title, busy = false, onApply, onRegenerate, onCancel, applyLabel = 'Remplacer' }) {
  return (
    <div className="rounded-xl border border-[#e3aa6b]/30 bg-[#e3aa6b]/[0.06] p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-[#e3aa6b]">{title}</p>
        <button
          type="button" onClick={onCancel} title="Abandonner la proposition"
          className="flex h-5 w-5 items-center justify-center rounded-md text-white/45 transition-colors hover:text-white/85"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div>
        <p className="mb-1 text-[8.5px] font-semibold uppercase tracking-wider text-white/40">Avant</p>
        <div className="max-h-20 overflow-y-auto rounded-lg border border-white/[0.07] bg-black/25 px-2 py-1.5 text-[10px] leading-relaxed text-white/45 [scrollbar-width:thin]">
          {before || <span className="italic text-white/25">(vide)</span>}
        </div>
      </div>

      <div>
        <p className="mb-1 text-[8.5px] font-semibold uppercase tracking-wider text-[#e3aa6b]">Après</p>
        <div className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#e3aa6b]/25 bg-black/25 px-2 py-1.5 text-[10px] leading-relaxed text-white/80 [scrollbar-width:thin]">
          {after}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button" onClick={onApply} disabled={busy}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#d97757]/40 bg-[#d97757]/15 py-1.5 text-[10px] font-semibold text-[#f0a98d] transition-all hover:bg-[#d97757]/25 disabled:opacity-40"
        >
          <Check className="h-3 w-3" /> {applyLabel}
        </button>
        {onRegenerate ? (
          <button
            type="button" onClick={onRegenerate} disabled={busy}
            title="Proposer une autre version"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/50 transition-all hover:text-white/85 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * @param {{ text: string, onApply: (text: string) => void }} props
 */
export default function DocumentTextAiActions({ text, onApply }) {
  const detectedType = useDocumentCoachStore((s) => s.detectedType);
  const modeLibre = useDocumentAiModeStore((s) => s.mode) === 'libre';

  const [busyId, setBusyId] = useState(/** @type {string|null} */ (null));
  const [variantes, setVariantes] = useState(/** @type {{ label: string, intention: string|null, items: any[] }|null} */ (null));
  const [termes, setTermes] = useState(/** @type {any[]|null} */ (null));
  const [choisie, setChoisie] = useState(/** @type {{ label: string, texte: string }|null} */ (null));
  const [error, setError] = useState('');
  const [langOpen, setLangOpen] = useState(false);
  /* Relecture orthographique : les fautes défilent UNE PAR UNE. `index` est la faute
     à l'écran ; `acceptees`/`refusees` alimentent le bilan de fin. */
  const [relecture, setRelecture] = useState(
    /** @type {{ items: any[], index: number, acceptees: number, refusees: number }|null} */ (null),
  );
  const [bilan, setBilan] = useState('');

  const source = useMemo(() => String(text ?? '').trim(), [text]);
  const contexte = useMemo(
    () => analyserContexteLocal(source, detectedType ?? undefined),
    [source, detectedType],
  );

  const runFormulation = useCallback(async (actionId, label, intention) => {
    if (!source) { setError('Ce bloc ne contient aucun texte.'); return; }
    setError(''); setTermes(null); setChoisie(null); setRelecture(null); setBilan(''); setBusyId(actionId);
    try {
      const res = await suggererFormulation(source, contexte, {
        intention: intention ?? undefined,
        nombre: 3,
        eviter: variantes?.intention === intention ? variantes.items.map((s) => s.texte) : [],
      });
      if (!res?.ok) { setError(res?.message || 'Reformulation indisponible.'); return; }
      setVariantes({ label, intention: intention ?? null, items: res.propositions ?? [] });
      if (res.partiel) setError('Canal de repli : une seule variante disponible.');
    } catch (e) {
      setError(e?.message || 'Appel impossible.');
    } finally {
      setBusyId(null);
    }
  }, [source, contexte, variantes]);

  const runTermes = useCallback(async () => {
    if (!source) { setError('Ce bloc ne contient aucun texte.'); return; }
    setError(''); setVariantes(null); setChoisie(null); setRelecture(null); setBilan(''); setBusyId('termes');
    try {
      const res = await suggererMotTechnique(source, contexte, { nombre: 4 });
      if (!res?.ok) { setError(res?.message || 'Terminologie indisponible.'); return; }
      setTermes(res.propositions ?? []);
      if (res.degrade) setError('Lexique local (modèle injoignable) — propositions réduites.');
    } catch (e) {
      setError(e?.message || 'Appel impossible.');
    } finally {
      setBusyId(null);
    }
  }, [source, contexte]);

  /**
   * Corriger les fautes — capacité NEUVE (Mistral, via `corrigerFautes`).
   * ⛔ Le mode « Contrôle libre » coupe ce bouton en amont (`disabled`) : aucun appel
   * réseau n'est même tenté. Le moteur pose le même verrou de son côté — il ne
   * construit alors même pas l'accès au modèle.
   */
  const runCorrection = useCallback(async () => {
    if (!source) { setError('Ce bloc ne contient aucun texte.'); return; }
    setError(''); setVariantes(null); setTermes(null); setChoisie(null);
    setRelecture(null); setBilan(''); setBusyId('corriger');
    try {
      const res = await corrigerFautes(source, { langue: 'fr', registre: contexte });
      if (!res?.ok) { setError(res?.degradeMessage || res?.message || 'Relecture indisponible.'); return; }
      const items = fautesARelire(res);
      if (res.degrade) setError(`Relecture locale seule — modèle injoignable (${res.degradeMessage || 'sans détail'}).`);
      else if (res.message) setError(res.message);
      if (!items.length) {
        setBilan('Relecture terminée — aucune faute détectée dans ce bloc.');
        return;
      }
      /* `decalage` : chaque correction acceptée change la LONGUEUR du texte, donc
         décale les positions de toutes les fautes suivantes. Sans ce report,
         `appliquerCorrections` rejetterait la 2ᵉ faute en « texte_modifie ». */
      setRelecture({ items, index: 0, acceptees: 0, refusees: 0, decalage: 0, source: res.source });
    } catch (e) {
      setError(e?.message || 'Appel impossible.');
    } finally {
      setBusyId(null);
    }
  }, [source, contexte]);

  /** Passe à la faute suivante, ou clôt la relecture par un bilan chiffré. */
  const avancerRelecture = useCallback((etat, acceptee, decalage) => {
    const index = etat.index + 1;
    const acceptees = etat.acceptees + (acceptee ? 1 : 0);
    const refusees = etat.refusees + (acceptee ? 0 : 1);
    if (index >= etat.items.length) {
      setRelecture(null);
      setBilan(
        `Relecture terminée — ${acceptees} correction${accord(acceptees)} appliquée${accord(acceptees)}, `
        + `${refusees} laissée${accord(refusees)} telle${accord(refusees)} quelle${accord(refusees)}.`,
      );
      return;
    }
    setRelecture({ ...etat, index, acceptees, refusees, decalage });
  }, []);

  /* Une faute acceptée = un patch de texte immédiat (donc un pas d'historique
     annulable), jamais un remplacement en bloc de tout le paragraphe. */
  const accepterFaute = useCallback(() => {
    if (!relecture) return;
    const f = relecture.items[relecture.index];
    const ajustee = {
      ...f,
      position: { debut: f.position.debut + relecture.decalage, fin: f.position.fin + relecture.decalage },
    };
    const res = appliquerCorrections(source, [ajustee]);
    if (!res.appliquees.length) {
      const raison = res.ignorees[0]?.raison ?? 'inconnue';
      setError(`« ${f.avant} » ne correspond plus au texte (${raison}) — cette correction est passée.`);
      avancerRelecture(relecture, false, relecture.decalage);
      return;
    }
    setError('');
    onApply(res.texte);
    avancerRelecture(relecture, true, relecture.decalage + (f.apres.length - f.avant.length));
  }, [relecture, source, onApply, avancerRelecture]);

  const refuserFaute = useCallback(() => {
    if (!relecture) return;
    avancerRelecture(relecture, false, relecture.decalage);
  }, [relecture, avancerRelecture]);


  return (
    <div className="flex flex-col gap-1.5 px-3 pb-3">
      {modeLibre ? (
        <p className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2 py-1.5 text-[9px] leading-relaxed text-white/40">
          Mode <strong className="text-white/60">Contrôle libre</strong> : ces commandes n'appellent rien.
          Changez de mode dans le panneau Architect pour les activer.
        </p>
      ) : null}

      {TEXT_ACTIONS.map((a) => (
        <button
          key={a.id}
          type="button"
          disabled={Boolean(busyId) || !source || modeLibre}
          onClick={() => runFormulation(a.id, a.label, a.intention)}
          className="flex w-full items-center gap-2.5 rounded-xl border border-[#d97757]/15 bg-[#d97757]/[0.06] px-2.5 py-2 text-left transition-all hover:border-[#d97757]/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#d97757]/15">
            {busyId === a.id
              ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#e08a5f]" />
              : <Sparkles className="h-3.5 w-3.5 text-[#e08a5f]" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium text-[#e8a97f]">{a.label}</p>
            <p className="truncate text-[9px] text-white/30">{a.sub}</p>
          </div>
        </button>
      ))}

      {/* Corriger les fautes — relecture faute par faute, jamais en bloc. */}
      <button
        type="button"
        disabled={Boolean(busyId) || !source || modeLibre}
        onClick={runCorrection}
        className="flex w-full items-center gap-2.5 rounded-xl border border-[#d97757]/15 bg-[#d97757]/[0.06] px-2.5 py-2 text-left transition-all hover:border-[#d97757]/25 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#d97757]/15">
          {busyId === 'corriger'
            ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#e08a5f]" />
            : <SpellCheck2 className="h-3.5 w-3.5 text-[#e08a5f]" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-[#e8a97f]">Corriger les fautes</p>
          <p className="truncate text-[9px] text-white/30">Orthographe et grammaire · une par une</p>
        </div>
      </button>

      {/* Traduire — la langue cible doit être choisie, sinon la commande est ambiguë. */}
      <button
        type="button"
        disabled={Boolean(busyId) || !source || modeLibre}
        onClick={() => setLangOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-[#d97757]/15 bg-[#d97757]/[0.06] px-2.5 py-2 text-left transition-all hover:border-[#d97757]/25 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#d97757]/15">
          {busyId === 'traduire'
            ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#e08a5f]" />
            : <Languages className="h-3.5 w-3.5 text-[#e08a5f]" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-[#e8a97f]">Traduire</p>
          <p className="truncate text-[9px] text-white/30">Choisir la langue cible</p>
        </div>
      </button>
      {langOpen && !modeLibre ? (
        <div className="grid grid-cols-2 gap-1">
          {LANGUAGES.map((lg) => (
            <button
              key={lg}
              type="button"
              disabled={Boolean(busyId)}
              onClick={() => {
                setLangOpen(false);
                runFormulation('traduire', `Traduction — ${lg}`, `traduction intégrale en ${lg} : ne rends que le texte traduit`);
              }}
              className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2 py-1.5 text-[9.5px] text-white/60 transition-all hover:bg-white/[0.06] disabled:opacity-40"
            >
              {lg}
            </button>
          ))}
        </div>
      ) : null}

      {/* Le « mot technique » du cahier — consultatif, aucune insertion automatique. */}
      <button
        type="button"
        disabled={Boolean(busyId) || !source || modeLibre}
        onClick={runTermes}
        className="flex w-full items-center gap-2.5 rounded-xl border border-[#d97757]/15 bg-[#d97757]/[0.06] px-2.5 py-2 text-left transition-all hover:border-[#d97757]/25 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#d97757]/15">
          {busyId === 'termes'
            ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#e08a5f]" />
            : <BookMarked className="h-3.5 w-3.5 text-[#e08a5f]" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-[#e8a97f]">Terme juste</p>
          <p className="truncate text-[9px] text-white/30">Vocabulaire du domaine</p>
        </div>
      </button>

      {!source ? (
        <p className="text-[9px] leading-relaxed text-white/30">
          Ce bloc est vide — saisissez du texte pour activer les commandes.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-500/25 bg-red-500/[0.07] px-2 py-1.5 text-[9.5px] leading-relaxed text-red-300">
          {error}
        </p>
      ) : null}

      {bilan ? (
        <p className="rounded-lg border border-[#7bb06a]/25 bg-[#7bb06a]/[0.07] px-2 py-1.5 text-[9.5px] leading-relaxed text-[#a8cf9a]">
          {bilan}
        </p>
      ) : null}

      {/* Relecture — UNE faute à l'écran, acceptée ou refusée, puis la suivante. */}
      {relecture ? (
        <div className="space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/50">
              Faute {relecture.index + 1} / {relecture.items.length}
            </p>
            <div className="flex items-center gap-1.5">
              {relecture.items[relecture.index].type ? (
                <span className="rounded-md border border-white/[0.09] bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white/45">
                  {libelleType(relecture.items[relecture.index].type)}
                </span>
              ) : null}
              <button
                type="button" onClick={() => setRelecture(null)}
                title="Abandonner la relecture"
                className="flex h-5 w-5 items-center justify-center rounded-md text-white/40 hover:text-white/80"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>

          {relecture.items[relecture.index].explication ? (
            <p className="rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5 text-[9.5px] leading-relaxed text-white/55">
              {relecture.items[relecture.index].explication}
            </p>
          ) : null}

          {/* Même aperçu AVANT / APRÈS que « Reformuler » — sur le fragment fautif. */}
          <TextDiffPreview
            title="Correction proposée"
            before={relecture.items[relecture.index].avant}
            after={relecture.items[relecture.index].apres}
            busy={Boolean(busyId)}
            applyLabel="Corriger"
            onApply={accepterFaute}
            onCancel={() => setRelecture(null)}
          />

          <button
            type="button" onClick={refuserFaute}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] py-1.5 text-[10px] font-semibold text-white/55 transition-all hover:text-white/85"
          >
            <SkipForward className="h-3 w-3" /> Laisser tel quel
          </button>

          <p className="text-[8.5px] leading-relaxed text-white/25">
            {relecture.acceptees} corrigée{accord(relecture.acceptees)} · {relecture.refusees} laissée{accord(relecture.refusees)} telle{accord(relecture.refusees)} quelle{accord(relecture.refusees)}
            {relecture.source ? ` · relecture ${relecture.source}` : ''}
          </p>
        </div>
      ) : null}

      {/* Variantes proposées — on choisit, PUIS on relit l'avant/après. */}
      {variantes && !choisie ? (
        <div className="space-y-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/50">
              {variantes.label} — {variantes.items.length} variante{variantes.items.length > 1 ? 's' : ''}
            </p>
            <button
              type="button" onClick={() => setVariantes(null)}
              className="flex h-5 w-5 items-center justify-center rounded-md text-white/40 hover:text-white/80"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          {variantes.items.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setChoisie({ label: variantes.label, texte: s.texte })}
              className="w-full rounded-lg border border-white/[0.07] bg-white/[0.02] p-2 text-left transition-all hover:border-[#e3aa6b]/35 hover:bg-white/[0.05]"
            >
              <p className="whitespace-pre-wrap text-[10px] leading-relaxed text-white/75">{s.texte}</p>
              {s.note ? <p className="mt-1 text-[9px] italic text-white/35">{s.note}</p> : null}
            </button>
          ))}
        </div>
      ) : null}

      {choisie ? (
        <TextDiffPreview
          title={choisie.label}
          before={source}
          after={choisie.texte}
          busy={Boolean(busyId)}
          onApply={() => { onApply(choisie.texte); setChoisie(null); setVariantes(null); }}
          onRegenerate={() => { setChoisie(null); }}
          onCancel={() => setChoisie(null)}
        />
      ) : null}

      {/* Terminologie — informative : rien n'est appliqué automatiquement. */}
      {termes ? (
        <div className="space-y-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/50">Terme juste</p>
            <button
              type="button" onClick={() => setTermes(null)}
              className="flex h-5 w-5 items-center justify-center rounded-md text-white/40 hover:text-white/80"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          {termes.length === 0 ? (
            <p className="text-[9.5px] leading-relaxed text-white/40">Le vocabulaire est déjà juste — rien à changer.</p>
          ) : (
            termes.map((t) => (
              <div key={t.id} className="rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5">
                <p className="text-[10px] font-semibold text-[#e8a97f]">{t.texte}</p>
                {t.note ? <p className="text-[9px] leading-relaxed text-white/40">{t.note}</p> : null}
              </div>
            ))
          )}
          <p className="text-[8.5px] leading-relaxed text-white/25">
            À appliquer à la main : remplacer un mot au milieu d'un bloc ne se fait pas sans votre lecture.
          </p>
        </div>
      ) : null}
    </div>
  );
}
