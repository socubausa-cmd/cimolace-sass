/**
 * DocumentIdentitePanel — « Identité d'entreprise » du créateur de document.
 *
 * Ce que l'écran fait : saisir UNE FOIS le logo, l'en-tête, le pied, les coordonnées,
 * les mentions légales, la marque et le bloc de signature d'une entité ; en garder
 * plusieurs (une active) ; voir un aperçu de la page marquée ; et la POSER sur le
 * document courant par un clic explicite.
 *
 * ⛔ RIEN NE S'APPLIQUE EN SILENCE. Une identité ne touche jamais un document ouvert
 * sans le bouton « Appliquer au document ». La pose remplace les bandes d'en-tête/pied
 * existantes (comme l'outil En-tête), fait DESCENDRE le corps sous la bande, et le DIT :
 * le nombre de blocs déplacés, les pages trop pleines, la signature non posée.
 *
 * ⛔ AUCUN CHAMP N'EST PRÉ-REMPLI. Pas d'adresse d'exemple, pas de SIRET, pas de logo
 * de démonstration : un gabarit d'entreprise pré-rempli de fausses données finit imprimé.
 *
 * ⚠️ PORTÉE DU STOCKAGE, écrite en clair dans l'écran : les identités vivent dans le
 * navigateur (localStorage). Il n'existe aucun endpoint front pour écrire une clé libre
 * dans `tenants.metadata` — la synchronisation par tenant reste à câbler (cf. l'en-tête
 * de useDocumentIdentiteStore.js).
 *
 * ⚠️ Le logo part dans le bucket PRIVÉ `smartboard-canvas` : on stocke la forme durable
 * et on re-signe à l'affichage (`useSmartboardCanvasSrc`), sans quoi l'aperçu tombe en
 * 403 une heure plus tard.
 *
 * Montage attendu (coque) : `<DocumentIdentitePanel />` dans le rail du Studio Document.
 * Le composant est autonome — il lit la scène active et écrit par
 * `appliquerMutationDocument` (un seul pas d'historique, Ctrl+Z annule tout).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck, Building2, Check, ChevronDown, ChevronRight, Eraser, Image as ImageIcon,
  Loader2, Plus, Save, Stamp, Trash2, TriangleAlert, Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSmartboardKonvaStore } from '@/features/smartboard-konva-editor/store/useSmartboardKonvaStore';
import { useDocumentIdentiteStore } from '@/features/smartboard-konva-editor/store/useDocumentIdentiteStore';
import { appliquerMutationDocument } from '@/features/smartboard-konva-editor/components/DocumentBusinessPanels';
/* [SIG-2] Une seule saisie de signature dans le produit — celle de DocumentSignaturePanel. */
import DocumentSignaturePanel from '@/features/smartboard-konva-editor/components/DocumentSignaturePanel';
import {
  DISPOSITIONS_ENTETE,
  HAUTEUR_LOGO_MIN,
  HAUTEUR_LOGO_MAX,
  appliquerIdentite,
  apercuIdentite,
  identitePosee,
  identiteVide,
  normaliserIdentite,
  resumeIdentite,
  retirerIdentite,
} from '@/features/smartboard-konva-editor/lib/documentIdentite';
import { FORMATS_PAGE, formatDepuisCanevas, MARGES_DEFAUT } from '@/features/smartboard-konva-editor/lib/documentPagination';
import { uploadSmartboardCanvasImage } from '@/lib/uploadSmartboardCanvasImage';
import { useSmartboardCanvasSrc } from '@/lib/smartboardCanvasUrl';

/* ═══════════════════════════════════════════════════════════════════
   Briques d'interface (mêmes classes que les autres panneaux du rail)
═══════════════════════════════════════════════════════════════════ */

const CLS_BTN = 'flex w-full items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.03] px-2.5 py-2 text-left text-[11px] font-medium text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35';
const CLS_BTN_ACCENT = 'flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#d4924a]/35 bg-[#d4924a]/15 px-2.5 py-2 text-[11px] font-semibold text-[#ecc98f] transition-all hover:bg-[#d4924a]/25 disabled:cursor-not-allowed disabled:opacity-35';
const CLS_INPUT = 'w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[10.5px] text-white/85 placeholder:text-white/25 focus:border-[#d4924a]/40 focus:outline-none';
const CLS_LABEL = 'block text-[9px] font-bold uppercase tracking-[0.14em] text-white/30';

function Champ({ label, children }) {
  return (
    <label className="block space-y-1">
      <span className={CLS_LABEL}>{label}</span>
      {children}
    </label>
  );
}

function Section({ titre, icone: Icone, ouverteParDefaut = false, children }) {
  const [ouverte, setOuverte] = useState(ouverteParDefaut);
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOuverte((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left"
      >
        {Icone ? <Icone className="h-3 w-3 shrink-0 text-white/35" /> : null}
        <span className="flex-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">{titre}</span>
        {ouverte
          ? <ChevronDown className="h-3 w-3 text-white/30" />
          : <ChevronRight className="h-3 w-3 text-white/30" />}
      </button>
      {ouverte ? <div className="space-y-2 border-t border-white/[0.06] px-2.5 py-2.5">{children}</div> : null}
    </div>
  );
}

function Bascule({ label, valeur, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!valeur)}
      className={cn(
        'flex w-full items-center justify-between rounded-lg border px-2 py-1.5 text-[10.5px] transition-colors',
        valeur
          ? 'border-[#d4924a]/35 bg-[#d4924a]/10 text-[#ecc98f]'
          : 'border-white/10 bg-black/30 text-white/45',
      )}
    >
      <span>{label}</span>
      {valeur ? <Check className="h-3 w-3" /> : <span className="text-[9px] uppercase tracking-wider">non</span>}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Lecture du document courant
═══════════════════════════════════════════════════════════════════ */

/** Objets de la scène active (lecture seule). */
function useObjetsScene() {
  const scenes = useSmartboardKonvaStore((s) => s.project?.scenes ?? []);
  const activeSceneId = useSmartboardKonvaStore((s) => s.project?.activeSceneId);
  return useMemo(
    () => scenes.find((s) => s.id === activeSceneId)?.objects ?? [],
    [scenes, activeSceneId],
  );
}

/**
 * Format et nombre de pages DÉDUITS du canevas.
 * ⚠️ Même règle de lecture que `useFormatPage` (DocumentBusinessPanels) :
 * `formatDepuisCanevas`, qui départage par la HAUTEUR les deux formats larges de
 * 794 px (A4 portrait / A5 paysage). Deux règles différentes donneraient deux
 * nombres de pages différents pour le même document.
 */
function useFormatCourant() {
  const w = useSmartboardKonvaStore((s) => s.project?.canvas?.width ?? FORMATS_PAGE.a4_portrait.largeur);
  const h = useSmartboardKonvaStore((s) => s.project?.canvas?.height ?? FORMATS_PAGE.a4_portrait.hauteur);
  return useMemo(() => {
    const format = formatDepuisCanevas(w, h) ?? FORMATS_PAGE.a4_portrait;
    return { cle: format.id, format, nbPages: Math.max(1, Math.round(h / format.hauteur)) };
  }, [w, h]);
}

/* ═══════════════════════════════════════════════════════════════════
   Aperçu de la page marquée
═══════════════════════════════════════════════════════════════════ */

/** Une image du bucket privé : la source est re-signée avant affichage. */
function ImageApercu({ src, style }) {
  const resolue = useSmartboardCanvasSrc(src);
  if (!resolue) return <div style={style} className="rounded-sm border border-dashed border-black/20" />;
  return <img src={resolue} alt="" style={style} className="object-contain" draggable={false} />;
}

/**
 * Aperçu FIDÈLE : il rend exactement les objets que la pose produirait
 * ({@link apercuIdentite}), à l'échelle. Un aperçu dessiné à part mentirait.
 */
function ApercuPage({ identite, cleFormat }) {
  const { objets, format } = useMemo(
    () => apercuIdentite({ identite, format: cleFormat, marges: MARGES_DEFAUT }),
    [identite, cleFormat],
  );
  const echelle = 190 / format.largeur;
  return (
    <div
      className="relative mx-auto overflow-hidden rounded-sm bg-white shadow-[0_2px_10px_rgba(0,0,0,0.35)]"
      style={{ width: 190, height: Math.round(format.hauteur * echelle) }}
    >
      {objets.map((o) => {
        const base = {
          position: 'absolute',
          left: o.x * echelle,
          top: o.y * echelle,
          width: o.width * echelle,
          height: o.height * echelle,
        };
        if (o.type === 'image') return <ImageApercu key={o.id} src={o.content.src} style={base} />;
        /* ⚠️ Une signature TRACÉE arrive en objets `line` : sans ce cas, l'aperçu
           affichait un rectangle vide et laissait croire que rien n'était posé. */
        if (o.type === 'line') {
          const pts = o.content?.points ?? [];
          const d = pts.reduce((acc, v, i) => (i % 2 ? `${acc} ${v}` : `${acc}${i ? ' L' : 'M'} ${v}`), '');
          return (
            <svg
              key={o.id}
              style={{ ...base, overflow: 'visible' }}
              viewBox={`0 0 ${Math.max(1, o.width)} ${Math.max(1, o.height)}`}
              preserveAspectRatio="none"
            >
              <path
                d={d}
                fill="none"
                stroke={o.style?.stroke || '#101828'}
                strokeWidth={(o.style?.strokeWidth || 2) / Math.max(0.01, echelle)}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          );
        }
        return (
          <div
            key={o.id}
            style={{
              ...base,
              height: 'auto',
              fontFamily: o.style.fontFamily,
              fontSize: Math.max(2.4, (o.style.fontSize || 11) * echelle),
              fontWeight: o.style.fontWeight,
              color: o.style.fill,
              textAlign: o.style.align,
              lineHeight: o.style.lineHeight,
              whiteSpace: 'pre-wrap',
              overflow: 'hidden',
            }}
          >
            {o.content.text}
          </div>
        );
      })}
      {!objets.length ? (
        <p className="absolute inset-x-2 top-1/2 -translate-y-1/2 text-center text-[8px] text-slate-400">
          Aucun champ renseigné : la page reste nue.
        </p>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Téléversement d'image (logo, signature)
═══════════════════════════════════════════════════════════════════ */

/**
 * Mesure locale AVANT téléversement : sans dimensions natives, la boîte du logo
 * ne peut être qu'un carré (documentIdentite le dit et ne devine pas).
 */
function mesurerFichier(file) {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const im = new window.Image();
      im.onload = () => {
        resolve({ largeurNative: im.naturalWidth || null, hauteurNative: im.naturalHeight || null });
        URL.revokeObjectURL(url);
      };
      im.onerror = () => { resolve({ largeurNative: null, hauteurNative: null }); URL.revokeObjectURL(url); };
      im.src = url;
    } catch {
      resolve({ largeurNative: null, hauteurNative: null });
    }
  });
}

function ChampImage({ label, image, onChange, onErreur }) {
  const inputRef = useRef(null);
  const [enCours, setEnCours] = useState(false);
  const apercu = useSmartboardCanvasSrc(image?.src || '');

  const choisir = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setEnCours(true);
    onErreur(null);
    try {
      const mesure = await mesurerFichier(file);
      const { url } = await uploadSmartboardCanvasImage(file);
      onChange({ ...image, src: url, ...mesure });
    } catch (err) {
      onErreur(err?.message || 'Téléversement impossible');
    } finally {
      setEnCours(false);
    }
  }, [image, onChange, onErreur]);

  return (
    <div className="space-y-1.5">
      <span className={CLS_LABEL}>{label}</span>
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
          {apercu
            ? <img src={apercu} alt="" className="max-h-full max-w-full object-contain" />
            : <ImageIcon className="h-3.5 w-3.5 text-white/20" />}
        </div>
        <div className="flex-1 space-y-1">
          <button type="button" className={CLS_BTN} disabled={enCours} onClick={() => inputRef.current?.click()}>
            {enCours ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            {image?.src ? 'Remplacer' : 'Téléverser'}
          </button>
          {image?.src ? (
            <button type="button" className={CLS_BTN} onClick={() => onChange({ ...image, src: '', largeurNative: null, hauteurNative: null })}>
              <Trash2 className="h-3 w-3" /> Retirer
            </button>
          ) : null}
        </div>
      </div>
      {image?.src && !image?.largeurNative ? (
        <p className="text-[9px] leading-snug text-[#e0b070]">
          Dimensions natives inconnues : l'image sera posée dans un carré (aucun rapport inventé).
        </p>
      ) : null}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={choisir} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Panneau
═══════════════════════════════════════════════════════════════════ */

export default function DocumentIdentitePanel({ onAppliquer = appliquerMutationDocument }) {
  const collection = useDocumentIdentiteStore((s) => s.collection);
  const charge = useDocumentIdentiteStore((s) => s.charge);
  const erreurStore = useDocumentIdentiteStore((s) => s.erreur);
  const charger = useDocumentIdentiteStore((s) => s.charger);
  const enregistrer = useDocumentIdentiteStore((s) => s.enregistrerIdentite);
  const supprimer = useDocumentIdentiteStore((s) => s.supprimerIdentite);
  const definirActive = useDocumentIdentiteStore((s) => s.definirIdentiteActive);

  const objets = useObjetsScene();
  const { cle: cleFormat, nbPages } = useFormatCourant();

  const [brouillon, setBrouillon] = useState(() => identiteVide());
  const [idEdite, setIdEdite] = useState(null);
  const [message, setMessage] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => { charger(); }, [charger]);

  /* L'identité active devient le brouillon — mais JAMAIS par-dessus une saisie en
     cours sur une autre identité (on perdrait la frappe de l'utilisateur). */
  useEffect(() => {
    if (!charge) return;
    if (idEdite !== null) return;
    const active = collection.identites.find((x) => x.id === collection.actifId);
    setBrouillon(active ? normaliserIdentite(active) : identiteVide());
    setIdEdite(active?.id ?? '');
  }, [charge, collection, idEdite]);

  /**
   * Écriture d'un champ du brouillon.
   * ⛔ AUCUNE normalisation ici : `normaliserIdentite` coupe les espaces de bord.
   * L'appliquer à chaque frappe empêcherait littéralement de taper une espace entre
   * deux mots. La normalisation a lieu à l'enregistrement, à l'aperçu et à la pose.
   */
  const majBrouillon = useCallback((chemin, valeur) => {
    setBrouillon((b) => {
      const copie = { ...b };
      const morceaux = chemin.split('.');
      let cible = copie;
      for (let i = 0; i < morceaux.length - 1; i += 1) {
        cible[morceaux[i]] = { ...cible[morceaux[i]] };
        cible = cible[morceaux[i]];
      }
      cible[morceaux[morceaux.length - 1]] = valeur;
      return copie;
    });
    setMessage(null);
  }, []);

  const resume = useMemo(() => resumeIdentite(brouillon), [brouillon]);
  const vide = resume.vide;
  const pose = useMemo(() => identitePosee(objets, nbPages), [objets, nbPages]);

  /* Comparaison hors dates et hors id : seul le CONTENU décide s'il reste à enregistrer. */
  const empreinte = useCallback(
    (i) => JSON.stringify(normaliserIdentite({ ...i, id: '', creeLe: '', majLe: '' })),
    [],
  );
  const enregistre = collection.identites.find((x) => x.id === brouillon.id) ?? null;
  const modifie = enregistre ? empreinte(enregistre) !== empreinte(brouillon) : !vide;

  /* ── Actions ───────────────────────────────────────────────── */

  const surEnregistrer = useCallback(async () => {
    setOccupe(true);
    setErreur(null);
    try {
      const sauvee = await enregistrer(brouillon);
      if (sauvee) {
        setBrouillon(normaliserIdentite(sauvee));
        setIdEdite(sauvee.id);
        setMessage(`Identité « ${sauvee.libelle || sauvee.raisonSociale || 'sans nom'} » enregistrée dans ce navigateur.`);
      }
    } catch (e) {
      setErreur(e?.message || 'Enregistrement impossible');
    } finally {
      setOccupe(false);
    }
  }, [brouillon, enregistrer]);

  const surNouvelle = useCallback(() => {
    setBrouillon(identiteVide());
    setIdEdite('');
    setMessage(null);
    setErreur(null);
  }, []);

  const surChoisir = useCallback(async (id) => {
    if (!id) { surNouvelle(); return; }
    await definirActive(id);
    const cible = collection.identites.find((x) => x.id === id);
    setBrouillon(cible ? normaliserIdentite(cible) : identiteVide());
    setIdEdite(id);
    setMessage(null);
  }, [collection.identites, definirActive, surNouvelle]);

  const surSupprimer = useCallback(async () => {
    if (!brouillon.id) return;
    await supprimer(brouillon.id);
    surNouvelle();
    setMessage('Identité supprimée. Les documents déjà marqués ne changent pas.');
  }, [brouillon.id, supprimer, surNouvelle]);

  /**
   * Pose sur le document courant. Un SEUL pas d'historique, et un compte rendu
   * de ce qui a bougé — un glissement silencieux du contenu est interdit.
   */
  const surAppliquer = useCallback(() => {
    setErreur(null);
    const res = appliquerIdentite({
      identite: brouillon,
      objets,
      page: { format: cleFormat, marges: MARGES_DEFAUT, nbPages },
    });
    if (!res.ajouts.length && !res.suppressions.length) {
      setMessage('Rien à poser : aucun champ renseigné.');
      return;
    }
    const ok = onAppliquer({
      ajouts: res.ajouts,
      patches: res.patches,
      suppressions: res.suppressions,
      selectionner: false,
    });
    if (!ok) { setErreur('Le document n’a pas accepté la pose.'); return; }

    const bouts = [`${res.resume.bandes} objet(s) posé(s) sur ${nbPages} page(s)`];
    if (res.patches.length) bouts.push(`${res.patches.length} bloc(s) descendus sous l'en-tête (Ctrl+Z annule tout)`);
    if (res.pagesBloquees.length) bouts.push(`page(s) ${res.pagesBloquees.join(', ')} trop pleine(s) : rien n'a pu descendre, lancez « Réorganiser en pages »`);
    else if (res.conflitsBas.length) bouts.push(`${new Set(res.conflitsBas).size} bloc(s) touchent la zone du pied`);
    if (!res.signaturePlacee && res.raisonSignature) bouts.push(`signature non posée — ${res.raisonSignature}`);
    if (!res.logoMesure) bouts.push('logo non mesuré : posé dans un carré');
    setMessage(`${bouts.join(' · ')}.`);
  }, [brouillon, objets, cleFormat, nbPages, onAppliquer]);

  const surRetirer = useCallback(() => {
    const { suppressions } = retirerIdentite(objets);
    if (!suppressions.length) { setMessage('Aucune identité posée sur ce document.'); return; }
    onAppliquer({ suppressions, selectionner: false });
    setMessage(`${suppressions.length} objet(s) d'identité retirés (le corps ne remonte pas tout seul : Ctrl+Z pour revenir en arrière).`);
  }, [objets, onAppliquer]);

  /* ── Rendu ─────────────────────────────────────────────────── */

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Building2 className="h-3.5 w-3.5 text-[#d4924a]" />
        <p className="flex-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Identité d'entreprise</p>
      </div>

      <p className="text-[9.5px] leading-snug text-white/35">
        Réglée une fois, elle marque chaque document : en-tête, pied, numérotation et bloc de signature.
      </p>

      {/* Choix de l'identité — [ID-4] */}
      <div className="space-y-1.5">
        <select
          className={CLS_INPUT}
          value={brouillon.id || ''}
          onChange={(e) => surChoisir(e.target.value)}
        >
          <option value="">— Nouvelle identité —</option>
          {collection.identites.map((x) => (
            <option key={x.id} value={x.id}>
              {(x.libelle || x.raisonSociale || 'Sans nom') + (x.id === collection.actifId ? ' (active)' : '')}
            </option>
          ))}
        </select>
        <div className="flex gap-1.5">
          <button type="button" className={CLS_BTN} onClick={surNouvelle}>
            <Plus className="h-3 w-3" /> Nouvelle
          </button>
          <button type="button" className={CLS_BTN} disabled={!brouillon.id} onClick={surSupprimer}>
            <Trash2 className="h-3 w-3" /> Supprimer
          </button>
        </div>
      </div>

      <Section titre="Entité" icone={BadgeCheck} ouverteParDefaut>
        <Champ label="Nom de la configuration">
          <input
            className={CLS_INPUT}
            value={brouillon.libelle}
            placeholder="ex. Siège, Agence, Marque B"
            onChange={(e) => majBrouillon('libelle', e.target.value)}
          />
        </Champ>
        <Champ label="Raison sociale">
          <input
            className={CLS_INPUT}
            value={brouillon.raisonSociale}
            placeholder="(vide tant que vous ne l'écrivez pas)"
            onChange={(e) => majBrouillon('raisonSociale', e.target.value)}
          />
        </Champ>
      </Section>

      <Section titre="En-tête et logo" icone={ImageIcon} ouverteParDefaut>
        <ChampImage
          label="Logo"
          image={brouillon.logo}
          onChange={(v) => majBrouillon('logo', v)}
          onErreur={setErreur}
        />
        <Champ label={`Hauteur du logo (${brouillon.logo.hauteur} px)`}>
          <input
            type="range"
            min={HAUTEUR_LOGO_MIN}
            max={HAUTEUR_LOGO_MAX}
            value={brouillon.logo.hauteur}
            className="w-full accent-[#d4924a]"
            onChange={(e) => majBrouillon('logo.hauteur', Number(e.target.value))}
          />
        </Champ>
        <Champ label="Disposition">
          <select
            className={CLS_INPUT}
            value={brouillon.entete.disposition}
            onChange={(e) => majBrouillon('entete.disposition', e.target.value)}
          >
            {DISPOSITIONS_ENTETE.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </Champ>
        <Champ label="Texte d'en-tête">
          <textarea
            className={cn(CLS_INPUT, 'min-h-[42px] resize-y')}
            value={brouillon.entete.texte}
            placeholder="ex. Direction générale"
            onChange={(e) => majBrouillon('entete.texte', e.target.value)}
          />
        </Champ>
        <Bascule
          label="Afficher la raison sociale"
          valeur={brouillon.entete.afficherRaisonSociale}
          onChange={(v) => majBrouillon('entete.afficherRaisonSociale', v)}
        />
      </Section>

      <Section titre="Pied de page" icone={Building2}>
        <Champ label="Adresse">
          <input className={CLS_INPUT} value={brouillon.coordonnees.adresse} onChange={(e) => majBrouillon('coordonnees.adresse', e.target.value)} />
        </Champ>
        <Champ label="Téléphone">
          <input className={CLS_INPUT} value={brouillon.coordonnees.telephone} onChange={(e) => majBrouillon('coordonnees.telephone', e.target.value)} />
        </Champ>
        <Champ label="Courriel">
          <input className={CLS_INPUT} value={brouillon.coordonnees.courriel} onChange={(e) => majBrouillon('coordonnees.courriel', e.target.value)} />
        </Champ>
        <Champ label="Site">
          <input className={CLS_INPUT} value={brouillon.coordonnees.site} onChange={(e) => majBrouillon('coordonnees.site', e.target.value)} />
        </Champ>
        <Champ label="Mentions légales">
          <textarea
            className={cn(CLS_INPUT, 'min-h-[42px] resize-y')}
            value={brouillon.pied.mentions}
            placeholder="ex. forme juridique, capital, immatriculation"
            onChange={(e) => majBrouillon('pied.mentions', e.target.value)}
          />
        </Champ>
        <Bascule label="Afficher les coordonnées" valeur={brouillon.pied.afficherCoordonnees} onChange={(v) => majBrouillon('pied.afficherCoordonnees', v)} />
        <Bascule label="Numéroter les pages" valeur={brouillon.pied.numerotation} onChange={(v) => majBrouillon('pied.numerotation', v)} />
        {brouillon.pied.numerotation ? (
          <>
            <Champ label="Gabarit ({{page}} et {{pages}})">
              <input className={CLS_INPUT} value={brouillon.pied.gabaritNumerotation} onChange={(e) => majBrouillon('pied.gabaritNumerotation', e.target.value)} />
            </Champ>
            <Bascule label="Sauter la première page" valeur={brouillon.pied.sauterPremiere} onChange={(v) => majBrouillon('pied.sauterPremiere', v)} />
          </>
        ) : null}
      </Section>

      {/* [SIG-2] Le bloc de signature EST le panneau Signature, monté ici en mode
          intégré : trois voies (tracée, téléversée, dactylographiée) et le bloc
          « Pour la direction, / Nom / Fonction / Date ».
          ⛔ Pas de second formulaire de signature dans cet écran : deux saisies
          concurrentes auraient enregistré deux signatures différentes.
          ⚠️ La `key` liée à l'identité éditée FORCE le remontage quand on change
          d'identité — sans elle, la signature de la précédente resterait affichée. */}
      <Section titre="Bloc de signature" icone={Stamp}>
        <DocumentSignaturePanel
          key={brouillon.id || 'identite-neuve'}
          mode="integre"
          signatureInitiale={brouillon.signature}
          onChangement={(s) => majBrouillon('signature', s)}
          onAppliquer={onAppliquer}
        />
      </Section>

      <Section titre="Marque" icone={BadgeCheck}>
        <div className="grid grid-cols-3 gap-1.5">
          {['primaire', 'secondaire', 'accent'].map((k) => (
            <label key={k} className="space-y-1">
              <span className={CLS_LABEL}>{k.slice(0, 4)}</span>
              <input
                type="color"
                value={brouillon.palette[k] || '#1e293b'}
                className="h-7 w-full cursor-pointer rounded-lg border border-white/10 bg-black/40"
                onChange={(e) => majBrouillon(`palette.${k}`, e.target.value)}
              />
            </label>
          ))}
        </div>
        <p className="text-[9px] leading-snug text-white/30">
          Primaire = encre de l'en-tête et de la signature. Secondaire = encre du pied.
        </p>
        <Champ label="Police des titres">
          <input className={CLS_INPUT} value={brouillon.polices.titre} placeholder="ex. Georgia, serif" onChange={(e) => majBrouillon('polices.titre', e.target.value)} />
        </Champ>
        <Champ label="Police du corps">
          <input className={CLS_INPUT} value={brouillon.polices.corps} placeholder="ex. Georgia, serif" onChange={(e) => majBrouillon('polices.corps', e.target.value)} />
        </Champ>
        <Champ label="Format par défaut">
          <select
            className={CLS_INPUT}
            value={brouillon.page.format || ''}
            onChange={(e) => majBrouillon('page.format', e.target.value)}
          >
            <option value="">— aucun (celui du document) —</option>
            {Object.values(FORMATS_PAGE).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </Champ>
        <p className="text-[9px] leading-snug text-white/30">
          Le format par défaut sert aux prochains documents ; il ne redimensionne pas le
          document ouvert (c'est le panneau Pages qui le fait).
        </p>
      </Section>

      {/* Aperçu */}
      <div className="space-y-1.5 rounded-xl border border-white/[0.07] bg-black/20 p-2.5">
        <p className={CLS_LABEL}>Aperçu de la page marquée</p>
        <ApercuPage identite={brouillon} cleFormat={cleFormat} />
        <p className="text-[9px] leading-snug text-white/30">
          {resume.remplis}/{resume.total} champs renseignés
          {resume.manquants.length ? ` — manquants : ${resume.manquants.join(', ')}.` : '.'}
        </p>
      </div>

      {/* Actions */}
      <div className="space-y-1.5">
        <button type="button" className={CLS_BTN} disabled={occupe || vide} onClick={surEnregistrer}>
          {occupe ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          {brouillon.id ? 'Enregistrer les modifications' : 'Enregistrer cette identité'}
          {modifie ? <span className="ml-auto text-[9px] text-[#e0b070]">non enregistré</span> : null}
        </button>
        <button type="button" className={CLS_BTN_ACCENT} disabled={vide} onClick={surAppliquer}>
          <Stamp className="h-3 w-3" /> Appliquer au document
        </button>
        <button type="button" className={CLS_BTN} disabled={!pose.posee} onClick={surRetirer}>
          <Eraser className="h-3 w-3" /> Retirer l'identité du document
        </button>
      </div>

      {pose.logoManquant ? (
        <p className="flex gap-1.5 rounded-lg border border-[#d4924a]/30 bg-[#d4924a]/10 px-2 py-1.5 text-[9.5px] leading-snug text-[#ecc98f]">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          Le logo ne couvre plus toutes les pages (l'ajout d'une page régénère les bandes
          texte mais pas les images) : réappliquez l'identité.
        </p>
      ) : null}

      {vide ? (
        <p className="text-[9px] leading-snug text-white/30">
          Aucun champ renseigné : rien à poser. Les champs restent vides tant que vous ne
          les écrivez pas — aucune donnée n'est inventée.
        </p>
      ) : null}

      {message ? (
        <p className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-1.5 text-[9.5px] leading-snug text-white/55">{message}</p>
      ) : null}
      {(erreur || erreurStore) ? (
        <p className="rounded-lg border border-[#e2553f]/30 bg-[#e2553f]/10 px-2 py-1.5 text-[9.5px] leading-snug text-[#f0a08f]">{erreur || erreurStore}</p>
      ) : null}

      <p className="text-[9px] leading-snug text-white/25">
        Stockage : ce navigateur uniquement (localStorage). La synchronisation par tenant
        n'est pas câblée — l'API n'expose aucun chemin d'écriture pour ces réglages.
      </p>
    </div>
  );
}

export { DocumentIdentitePanel };
