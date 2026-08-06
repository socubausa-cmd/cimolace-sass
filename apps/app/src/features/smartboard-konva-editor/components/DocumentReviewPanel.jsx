/**
 * DocumentReviewPanel — revue de mise en page du Studio Document.
 *
 * Cahier des charges :
 *   §5  « À la fin, l'IA analyse la mise en forme, la critique, l'améliore
 *        AVANT l'export. »   → onglet « Diagnostic »
 *   §6  « Une IA design pour la mise en page : police, grammaire visuelle,
 *        couleur, blocs de mots à redesigner. »  → onglet « Habillage »
 *        La grammaire visuelle (table `GRAMMAIRE_VISUELLE` ci-dessous) produit de
 *        VRAIS patches d'objets — elle n'est plus une liste décorative.
 *
 * Trois règles tenues par ce panneau :
 *   · Chaque constat affiche SA MESURE. Aucun adjectif sans chiffre.
 *   · Chaque correction s'applique UNE PAR UNE, avec le nombre de blocs touchés
 *     annoncé avant le clic. Il n'existe pas de « tout corriger » opaque.
 *   · Ce que le moteur ne sait pas mesurer est affiché, pas caché.
 *
 * Aucun bouton décoratif : tout ce qui est cliquable agit, et ce qui ne peut pas
 * agir est rendu désactivé AVEC sa raison écrite en clair.
 *
 * Couleurs — charte LIRI (zéro froid), identiques à DocumentCoachPanel :
 * corail #d97757/#e08b6d = actions · argile #cf8059 = identité · or #e6cc92 = info.
 * Rouge / ambre restent des CODES D'ÉTAT, l'olive #7bb06a le verdict positif.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ScanLine, AlertTriangle, AlertOctagon, Info, CheckCircle2, Wand2,
  Eye, Ruler, Type, Palette, RefreshCw, HelpCircle, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSmartboardKonvaStore } from '@/features/smartboard-konva-editor/store/useSmartboardKonvaStore';
import { useDocumentCoachStore } from '@/features/smartboard-konva-editor/store/useDocumentCoachStore';
import { getTemplateById } from '@/features/smartboard-konva-editor/lib/documentTemplateLibrary';
import {
  critiquerMiseEnPage,
  proposerHabillage,
  patchesPourHabillage,
  appliquerPatches,
  attribuerRoles,
} from '@/features/smartboard-konva-editor/lib/documentDesignCritique';

/* ═══════════════════════════════════════════════════════════════════
   Grammaire visuelle (§6) — les styles LIRI transposés en patches réels
═══════════════════════════════════════════════════════════════════ */

/**
 * Chaque rôle de bloc porte un style LIRI (`variante.blocs[].styleLiri`), défini
 * dans le pack par un preset Konva de SLIDE (1037×750, encre violette, corps 54 px).
 * Le poser tel quel sur une page A4 serait absurde : on n'en garde que la
 * GRAMMAIRE — ce que le preset fait de particulier — et seulement les propriétés
 * que le rendu texte du canevas honore réellement (`KonvaBoardObject.jsx` : align,
 * letterSpacing, textDecoration, fontStyle, fontWeight, fill…).
 *
 * ⚠️ ORDRE : le volet « échelle » possède `letterSpacing` (valeur du palier). Si on
 * l'applique APRÈS la grammaire, l'interlettrage retombe à la valeur du palier.
 * La grammaire s'applique donc en dernier — c'est écrit dans le panneau.
 *
 * ⛔ Aucune entrée n'invente de propriété : ce qui ne se rend pas est déclaré
 * `style: null` avec sa raison, et le bouton reste désactivé au lieu de mentir.
 */
export const GRAMMAIRE_VISUELLE = {
  title_hero: {
    presetSource: 'text_01_hero_centered',
    resume: 'centré · interlettrage +0,3',
    style: () => ({ align: 'center', letterSpacing: 0.3, textDecoration: '' }),
  },
  subtitle_clean: {
    presetSource: 'text_07_subtitle_small_caps',
    resume: 'interlettrage +2,1 · fer à gauche',
    style: () => ({ align: 'left', letterSpacing: 2.1, textDecoration: '' }),
    reserve:
      'Les petites capitales du preset supposeraient de passer le texte en majuscules : ce panneau ne réécrit jamais un contenu.',
  },
  underline_title: {
    presetSource: 'text_02_hero_left_editorial',
    resume: 'souligné · fer à gauche',
    style: () => ({ align: 'left', textDecoration: 'underline' }),
    reserve:
      "Le filet d'accent du preset devient un soulignement de texte : un filet séparé serait un objet ajouté, pas un rhabillage.",
  },
  boxed_text: {
    presetSource: 'text_06_section_header',
    style: null,
    raison:
      "Un encadré demande un rectangle DERRIÈRE le texte : le bloc texte du canevas n'a ni fond ni marge intérieure. Ce serait un objet ajouté, pas un patch de style.",
  },
};

/** Valeurs implicites du rendu — sans elles, un bloc jamais touché paraît toujours « à changer ». */
const DEFAUTS_STYLE = { align: 'left', textDecoration: '', letterSpacing: 0 };
const valeurStyle = (objet, cle) => objet?.style?.[cle] ?? DEFAUTS_STYLE[cle];

/**
 * Patches de grammaire visuelle. Même attribution de rôles que
 * `patchesPourHabillage` (via `attribuerRoles`) : les deux volets ne peuvent pas
 * diverger sur ce qui est un titre.
 *
 * @param {Array<object>} objets
 * @param {object} variante  élément de `proposerHabillage().variantes`
 * @returns {Array<{id: string, partial: object, role: string, styleLiri: string}>}
 */
export function patchesGrammaire(objets, variante) {
  if (!variante) return [];
  const parRole = new Map((variante.blocs ?? []).map((b) => [b.role, b]));
  const patches = [];

  for (const { objet, role } of attribuerRoles(objets, variante.echelle)) {
    const styleLiri = parRole.get(role)?.styleLiri;
    const grammaire = styleLiri ? GRAMMAIRE_VISUELLE[styleLiri] : null;
    if (!grammaire?.style) continue;

    const style = grammaire.style(variante);
    const change = Object.entries(style).some(([k, v]) => valeurStyle(objet, k) !== v);
    if (change) patches.push({ id: objet.id, partial: { style }, role, styleLiri });
  }
  return patches;
}

/* ─── Tokens de gravité ──────────────────────────────────────────── */
const GRAVITE_STYLE = {
  bloquant: { icon: AlertOctagon,  label: 'Bloquant', cls: 'text-red-400',   box: 'border-red-500/25 bg-red-500/[0.07]'       },
  majeur:   { icon: AlertTriangle, label: 'Majeur',   cls: 'text-amber-400', box: 'border-amber-500/25 bg-amber-500/[0.07]'   },
  mineur:   { icon: Info,          label: 'Mineur',   cls: 'text-[#e6cc92]', box: 'border-[#e6cc92]/25 bg-[#e6cc92]/[0.06]'   },
  info:     { icon: Info,          label: 'À voir',   cls: 'text-white/45',  box: 'border-white/[0.09] bg-white/[0.03]'        },
};

const VERDICT = {
  vide:      { texte: 'Page vide — rien à mesurer.',                      cls: 'text-white/45',   box: 'border-white/[0.09] bg-white/[0.03]' },
  bloquant:  { texte: 'À corriger avant export : du contenu se perd.',    cls: 'text-red-300',    box: 'border-red-500/30 bg-red-500/[0.08]' },
  a_corriger:{ texte: 'Lisible, mais la forme peut être resserrée.',      cls: 'text-amber-200',  box: 'border-amber-500/25 bg-amber-500/[0.07]' },
  propre:    { texte: 'Rien de mesurable à redire sur la forme.',         cls: 'text-[#9cc48a]',  box: 'border-[#5a8f52]/30 bg-[#5a8f52]/[0.10]' },
};

/* ─── Boutons ────────────────────────────────────────────────────── */
function BoutonAction({ children, onClick, disabled, raison, ton = 'corail', icon: Icon }) {
  const tons = {
    corail: 'border-[#d97757]/30 bg-[#d97757]/[0.09] text-[#e08b6d] hover:bg-[#d97757]/20',
    sobre: 'border-white/[0.10] bg-white/[0.03] text-white/65 hover:bg-white/[0.07]',
    or: 'border-[#e3aa6b]/30 bg-[#e3aa6b]/[0.09] text-[#e3aa6b] hover:bg-[#e3aa6b]/[0.18]',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? raison : undefined}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[9.5px] font-semibold transition-all',
        disabled ? 'cursor-not-allowed border-white/[0.07] bg-white/[0.02] text-white/25' : tons[ton],
      )}
    >
      {Icon ? <Icon className="h-3 w-3 shrink-0" /> : null}
      {children}
    </button>
  );
}

/* ─── Carte de constat ───────────────────────────────────────────── */
function CarteConstat({ c, onMontrer, onAppliquer }) {
  const st = GRAVITE_STYLE[c.gravite] ?? GRAVITE_STYLE.info;
  const Icon = st.icon;
  return (
    <div className={cn('rounded-xl border px-2.5 py-2', st.box)}>
      <div className="flex items-start gap-2">
        <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', st.cls)} />
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold leading-snug text-white/85">
            <span className={cn('mr-1 text-[8px] font-bold uppercase tracking-wide', st.cls)}>{st.label}</span>
            {c.titre}
          </p>
          {/* La mesure : ce qui distingue un diagnostic d'un avis. */}
          <p className="mt-1 break-words text-[9px] leading-relaxed text-white/50">{c.mesure}</p>
          {c.correction?.detail ? (
            <p className="mt-1 text-[8.5px] leading-relaxed text-white/35">{c.correction.detail}</p>
          ) : null}
          {!c.correction && c.pourquoiPasAuto ? (
            <p className="mt-1 flex gap-1 text-[8.5px] leading-relaxed text-white/40">
              <HelpCircle className="mt-[1px] h-2.5 w-2.5 shrink-0" />
              <span>{c.pourquoiPasAuto}</span>
            </p>
          ) : null}

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <BoutonAction
              ton="sobre"
              icon={Eye}
              onClick={() => onMontrer(c)}
              disabled={!c.objetIds?.length}
              raison="Aucun bloc identifié pour ce constat."
            >
              Montrer {c.objetIds?.length ? `(${c.objetIds.length})` : ''}
            </BoutonAction>
            <BoutonAction
              icon={Wand2}
              onClick={() => onAppliquer(c)}
              disabled={!c.correction?.patches?.length}
              raison={c.pourquoiPasAuto || 'Aucune correction automatique sûre pour ce constat.'}
            >
              {c.correction?.patches?.length
                ? `${c.correction.label} (${c.correction.patches.length})`
                : 'Correction manuelle'}
            </BoutonAction>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Panneau ────────────────────────────────────────────────────── */
export default function DocumentReviewPanel({ className }) {
  const project = useSmartboardKonvaStore((s) => s.project);
  const pushHistory = useSmartboardKonvaStore((s) => s.pushHistory);
  const updateObject = useSmartboardKonvaStore((s) => s.updateObject);
  const setSelectedIds = useSmartboardKonvaStore((s) => s.setSelectedIds);

  const detectedType = useDocumentCoachStore((s) => s.detectedType);
  const selectedTemplate = useDocumentCoachStore((s) => s.selectedTemplate);
  const documentPlan = useDocumentCoachStore((s) => s.documentPlan);

  const [onglet, setOnglet] = useState(/** @type {'diagnostic'|'habillage'} */ ('diagnostic'));
  const [rapport, setRapport] = useState(null);
  /** Référence du tableau d'objets au moment de l'analyse → détecte la péremption. */
  const [objetsAnalyses, setObjetsAnalyses] = useState(null);
  const [journal, setJournal] = useState('');
  const [varianteId, setVarianteId] = useState(null);

  const templateId = selectedTemplate?.id ?? documentPlan?.libraryTemplateId ?? null;

  const sceneActive = useMemo(
    () => project.scenes.find((s) => s.id === project.activeSceneId) ?? project.scenes[0],
    [project],
  );
  const objets = sceneActive?.objects ?? [];

  const formatPage = useMemo(() => {
    const modele = templateId ? getTemplateById(templateId) : null;
    return {
      width: project.canvas?.width,
      height: project.canvas?.height,
      fond: project.canvas?.background,
      page_setup: modele?.page_setup ?? null,
    };
  }, [project.canvas, templateId]);

  const habillage = useMemo(
    () => proposerHabillage(detectedType, { templateId }),
    [detectedType, templateId],
  );
  const variante =
    habillage.variantes.find((v) => v.id === varianteId) ?? habillage.retenue;

  const perime = Boolean(rapport && objetsAnalyses && objetsAnalyses !== objets);

  const analyser = useCallback(() => {
    const scene =
      useSmartboardKonvaStore.getState().project.scenes.find(
        (s) => s.id === useSmartboardKonvaStore.getState().project.activeSceneId,
      ) ?? null;
    const liste = scene?.objects ?? [];
    setRapport(critiquerMiseEnPage(liste, formatPage, { typeDoc: detectedType, templateId }));
    setObjetsAnalyses(liste);
    setJournal('');
  }, [formatPage, detectedType, templateId]);

  const montrer = useCallback(
    (c) => {
      setSelectedIds(c.objetIds ?? []);
      setJournal(`${c.objetIds?.length ?? 0} bloc(s) sélectionné(s) sur le canevas.`);
    },
    [setSelectedIds],
  );

  const appliquer = useCallback(
    (c) => {
      const n = appliquerPatches(c.correction?.patches, { pushHistory, updateObject });
      setJournal(
        n
          ? `${c.correction.label} — ${n} bloc(s) modifié(s). « Annuler » (Cmd+Z) revient en arrière.`
          : 'Rien à modifier : les blocs étaient déjà conformes.',
      );
      /** Le diagnostic doit être relu après coup : une correction en révèle parfois une autre. */
      if (n) setTimeout(analyser, 0);
    },
    [pushHistory, updateObject, analyser],
  );

  const appliquerHabillage = useCallback(
    (quoi, libelle) => {
      const scene =
        useSmartboardKonvaStore.getState().project.scenes.find(
          (s) => s.id === useSmartboardKonvaStore.getState().project.activeSceneId,
        ) ?? null;
      const patches = patchesPourHabillage(scene?.objects ?? [], variante, quoi);
      const n = appliquerPatches(patches, { pushHistory, updateObject });
      setJournal(
        n
          ? `${libelle} — ${n} bloc(s) rhabillé(s). Le texte n'a pas été touché.`
          : `${libelle} — aucun bloc à changer, tout est déjà à cette valeur.`,
      );
      if (n && rapport) setTimeout(analyser, 0);
    },
    [variante, pushHistory, updateObject, rapport, analyser],
  );

  const comptePatches = useCallback(
    (quoi) => patchesPourHabillage(objets, variante, quoi).length,
    [objets, variante],
  );

  /** §6 — grammaire visuelle : mêmes règles d'application que les trois autres volets. */
  const appliquerGrammaire = useCallback(() => {
    const scene =
      useSmartboardKonvaStore.getState().project.scenes.find(
        (s) => s.id === useSmartboardKonvaStore.getState().project.activeSceneId,
      ) ?? null;
    const patches = patchesGrammaire(scene?.objects ?? [], variante);
    const n = appliquerPatches(patches, { pushHistory, updateObject });
    const styles = [...new Set(patches.map((p) => p.styleLiri))];
    setJournal(
      n
        ? `Grammaire visuelle — ${n} bloc(s) rhabillé(s) (${styles.join(', ')}). Le texte n'a pas été touché.`
        : 'Grammaire visuelle — aucun bloc à changer, tout est déjà à cette forme.',
    );
    if (n && rapport) setTimeout(analyser, 0);
  }, [variante, pushHistory, updateObject, rapport, analyser]);

  const compteGrammaire = useMemo(
    () => patchesGrammaire(objets, variante).length,
    [objets, variante],
  );

  /** Rôles réellement présents sur la page — pour ne pas promettre un style sans bloc. */
  const rolesPresents = useMemo(() => {
    const s = new Set();
    for (const a of attribuerRoles(objets, variante.echelle)) s.add(a.role);
    return s;
  }, [objets, variante]);

  const verdict = rapport ? (VERDICT[rapport.verdict] ?? VERDICT.a_corriger) : null;

  return (
    <div className={cn('flex flex-col gap-2.5 pb-2', className)}>
      {/* En-tête */}
      <div className="flex items-center gap-2 px-0.5">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[#cf8059]/25 bg-[#cf8059]/[0.10]">
          <ScanLine className="h-3 w-3 text-[#cf8059]" />
        </div>
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold text-white/85">Revue de mise en page</p>
          <p className="text-[8.5px] text-white/40">Mesures sur la page — à lire avant l'export.</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1">
        {[
          { id: 'diagnostic', label: 'Diagnostic', icon: Ruler },
          { id: 'habillage', label: 'Habillage', icon: Palette },
        ].map((t) => {
          const Icon = t.icon;
          const actif = onglet === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setOnglet(t.id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-1.5 text-[9.5px] font-semibold transition-all',
                actif
                  ? 'border-[#cf8059]/35 bg-[#cf8059]/[0.10] text-[#e08b6d]'
                  : 'border-white/[0.07] bg-white/[0.02] text-white/45 hover:bg-white/[0.05]',
              )}
            >
              <Icon className="h-3 w-3" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ═══ Diagnostic ═══ */}
      {onglet === 'diagnostic' && (
        <div className="space-y-2">
          <BoutonAction
            ton={rapport ? 'sobre' : 'corail'}
            icon={rapport ? RefreshCw : ScanLine}
            onClick={analyser}
          >
            {rapport ? 'Relancer l’analyse' : 'Analyser la mise en page'}
          </BoutonAction>

          {perime ? (
            <p className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-2.5 py-1.5 text-[9px] text-amber-200/85">
              Le document a changé depuis l’analyse — relancez pour des mesures à jour.
            </p>
          ) : null}

          {!rapport ? (
            <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-2 text-[9.5px] leading-relaxed text-white/45">
              Rien n’est mesuré tant que vous n’avez pas lancé l’analyse : marges, hiérarchie des
              tailles, interlignage, longueur de ligne, contraste, débordements, superpositions et
              champs à trous restants.
            </p>
          ) : (
            <>
              {/* Mesures brutes */}
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
                <p className="mb-1 text-[8.5px] font-bold uppercase tracking-widest text-white/35">
                  Relevé
                </p>
                <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] text-white/50">
                  <div><dt className="inline text-white/35">Page </dt><dd className="inline">{rapport.resume.page}</dd></div>
                  <div><dt className="inline text-white/35">Zone utile </dt><dd className="inline">{rapport.resume.zoneContenu}</dd></div>
                  <div><dt className="inline text-white/35">Blocs </dt><dd className="inline">{rapport.resume.objets}</dd></div>
                  <div><dt className="inline text-white/35">Dont texte </dt><dd className="inline">{rapport.resume.blocsTexte}</dd></div>
                  <div><dt className="inline text-white/35">Caractères </dt><dd className="inline">{rapport.resume.caracteres}</dd></div>
                  <div><dt className="inline text-white/35">Fond </dt><dd className="inline">{String(rapport.resume.fondPage)}</dd></div>
                  <div className="col-span-2">
                    <dt className="inline text-white/35">Corps utilisés </dt>
                    <dd className="inline">
                      {rapport.resume.taillesDistinctes.length
                        ? `${rapport.resume.taillesDistinctes.join(' / ')} px`
                        : '—'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Verdict + comptes */}
              <div className={cn('rounded-xl border px-2.5 py-2', verdict.box)}>
                <div className="flex items-center gap-2">
                  {rapport.verdict === 'propre' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#7bb06a]" />
                  ) : (
                    <AlertTriangle className={cn('h-3.5 w-3.5 shrink-0', verdict.cls)} />
                  )}
                  <p className={cn('text-[10px] font-semibold', verdict.cls)}>{verdict.texte}</p>
                </div>
                <p className="mt-1 text-[8.5px] text-white/45">
                  {rapport.compte.bloquant} bloquant · {rapport.compte.majeur} majeur ·{' '}
                  {rapport.compte.mineur} mineur · {rapport.compte.info} à voir
                </p>
              </div>

              {journal ? (
                <p className="rounded-xl border border-[#cf8059]/20 bg-[#cf8059]/[0.07] px-2.5 py-1.5 text-[9px] text-white/60">
                  {journal}
                </p>
              ) : null}

              {/* Constats */}
              <div className="space-y-1.5">
                {rapport.constats.map((c) => (
                  <CarteConstat key={c.id} c={c} onMontrer={montrer} onAppliquer={appliquer} />
                ))}
              </div>

              {/* Limites assumées */}
              <details className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5">
                <summary className="cursor-pointer text-[8.5px] font-bold uppercase tracking-widest text-white/35">
                  Ce que je ne sais pas mesurer ({rapport.nonMesure.length})
                </summary>
                <ul className="mt-1.5 space-y-1.5">
                  {rapport.nonMesure.map((n, i) => (
                    <li key={i} className="text-[9px] leading-relaxed text-white/45">
                      <span className="text-white/65">{n.titre}</span> — {n.pourquoi}
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}
        </div>
      )}

      {/* ═══ Habillage ═══ */}
      {onglet === 'habillage' && (
        <div className="space-y-2">
          <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 text-[9px] leading-relaxed text-white/45">
            Registre <span className="text-white/70">{habillage.registreLabel}</span> · habillage tiré
            de {habillage.source.modeleNom ? `« ${habillage.source.modeleNom} »` : 'la charte par défaut'} et
            du {habillage.source.pack}. Aucun texte n’est réécrit ici : seuls police, corps, encre et
            forme des blocs changent.
          </p>

          {/* Variantes */}
          <div className="space-y-1">
            <p className="text-[8.5px] font-bold uppercase tracking-widest text-white/35">Variantes</p>
            <div className="grid grid-cols-1 gap-1">
              {habillage.variantes.map((v) => {
                const actif = v.id === variante.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVarianteId(v.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-all',
                      actif
                        ? 'border-[#e3aa6b]/35 bg-[#e3aa6b]/[0.09]'
                        : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]',
                    )}
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded-full border border-white/15"
                      style={{ background: v.palette.accent }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10px] font-semibold text-white/80">{v.label}</span>
                      <span className="block truncate text-[8.5px] text-white/40">
                        Titres {v.polices.titre} · corps {v.polices.corps}
                      </span>
                    </span>
                    {actif ? <CheckCircle2 className="h-3 w-3 shrink-0 text-[#e3aa6b]" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Échelle */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
            <p className="mb-1 text-[8.5px] font-bold uppercase tracking-widest text-white/35">
              Échelle typographique
            </p>
            <ul className="space-y-0.5">
              {variante.echelle.map((e) => (
                <li key={e.role} className="flex items-baseline justify-between gap-2 text-[9px]">
                  <span className="truncate text-white/55">{e.label}</span>
                  <span className="shrink-0 text-white/40">
                    {e.taille} px · {e.graisse} · ×{e.lineHeight}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Palette */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
            <p className="mb-1.5 text-[8.5px] font-bold uppercase tracking-widest text-white/35">Palette</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(variante.palette).map(([nom, val]) => (
                <div key={nom} className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-1.5 py-1">
                  <span
                    className="h-3 w-3 rounded-sm border border-white/15"
                    style={{ background: val }}
                  />
                  <span className="text-[8px] text-white/45">{nom}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Traitement des blocs */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
            <p className="mb-1 flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-widest text-white/35">
              <Layers className="h-2.5 w-2.5" /> Traitement des blocs
            </p>
            <ul className="space-y-1">
              {variante.blocs.map((b) => {
                const g = b.styleLiri ? GRAMMAIRE_VISUELLE[b.styleLiri] : null;
                const branche = Boolean(g?.style);
                const present = rolesPresents.has(b.role);
                return (
                  <li key={b.role} className="text-[9px]">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-white/55">{b.label}</span>
                      <span className="shrink-0 truncate text-white/35" title={b.presetPro ?? ''}>
                        {b.styleLabel}
                      </span>
                    </div>
                    <p
                      className={cn(
                        'mt-0.5 flex items-start gap-1 text-[8px] leading-relaxed',
                        branche ? 'text-[#9cc48a]' : 'text-white/35',
                      )}
                    >
                      {branche ? (
                        <>
                          <CheckCircle2 className="mt-[1px] h-2.5 w-2.5 shrink-0" />
                          <span>
                            {g.resume}
                            {present ? '' : ' — aucun bloc de ce rôle sur la page'}
                            {g.reserve ? ` · ${g.reserve}` : ''}
                          </span>
                        </>
                      ) : (
                        <>
                          <HelpCircle className="mt-[1px] h-2.5 w-2.5 shrink-0" />
                          <span>Non applicable — {g?.raison ?? 'style inconnu du pont de grammaire.'}</span>
                        </>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-1 text-[8px] leading-relaxed text-white/30">
              Styles issus du pack texte LIRI (style_map de auto_text_design_engine), transposés du
              preset de slide vers la page A4 : seule la grammaire est reprise, jamais les corps ni
              les couleurs de slide. Un seul style reste non branché,{' '}
              <span className="text-white/50">« Encadré texte »</span> (corps et mention) — il
              demanderait un rectangle de fond, donc un objet ajouté.
            </p>
          </div>

          {/* Applications — trois volets séparés, jamais un « tout corriger » */}
          <div className="space-y-1">
            <p className="text-[8.5px] font-bold uppercase tracking-widest text-white/35">Appliquer</p>
            {[
              { quoi: { polices: true }, label: 'les polices', icon: Type },
              { quoi: { echelle: true }, label: 'l’échelle (corps, graisse, interligne)', icon: Ruler },
              { quoi: { encre: true }, label: 'l’encre', icon: Palette },
            ].map((a) => {
              const n = comptePatches(a.quoi);
              return (
                <BoutonAction
                  key={a.label}
                  ton="corail"
                  icon={a.icon}
                  onClick={() => appliquerHabillage(a.quoi, `Application : ${a.label}`)}
                  disabled={n === 0}
                  raison="Tous les blocs portent déjà cette valeur."
                >
                  Appliquer {a.label} — {n} bloc(s)
                </BoutonAction>
              );
            })}

            {/* §6 — la grammaire visuelle, en dernier : l'échelle possède l'interlettrage. */}
            <BoutonAction
              ton="or"
              icon={Layers}
              onClick={appliquerGrammaire}
              disabled={compteGrammaire === 0}
              raison="Aucun bloc à rhabiller : les blocs portent déjà cette forme, ou leur style n’est pas applicable."
            >
              Appliquer la grammaire visuelle — {compteGrammaire} bloc(s)
            </BoutonAction>

            <p className="text-[8px] leading-relaxed text-white/30">
              Les rôles sont déduits du RANG des tailles déjà présentes (le plus gros bloc = titre) :
              votre hiérarchie est respectée, pas devinée. Un seul point d’annulation par application.
              ⚠️ La grammaire s’applique <span className="text-white/50">après</span> l’échelle :
              l’échelle possède l’interlettrage et l’écraserait.
            </p>
          </div>

          {journal ? (
            <p className="rounded-xl border border-[#cf8059]/20 bg-[#cf8059]/[0.07] px-2.5 py-1.5 text-[9px] text-white/60">
              {journal}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
