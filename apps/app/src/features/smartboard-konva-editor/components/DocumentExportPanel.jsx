/**
 * Centre d'export du Studio Document.
 *
 * ⛔ POURQUOI CE PANNEAU EXISTE : le bouton « Exporter » de la barre du haut menait
 * à /studio/export-center, qui lit le store des SLIDES. En mode Document il répondait
 * « Aucun slide à exporter » — un document A4 n'a jamais eu d'export.
 *
 * ⛔ ORDRE DU CAHIER : la critique de mise en forme s'affiche AVANT le bouton
 * d'export. Elle INFORME, elle n'interdit pas : `preparerExport` ne renvoie aucun
 * drapeau de blocage et ce panneau n'en invente pas.
 *
 * ⛔ IMAGES (défaut [IMG-PDF], mesuré le 2026-08-05) : ce panneau n'envoyait NI le
 * re-signeur du bucket privé NI les avertissements d'export. Résultat : 3 images sur
 * la page, 0 dans le PDF, et pas un mot — ni avant (critique muette) ni après
 * (`avertissements` jeté). Les trois manques sont comblés ici : `resoudreSrcImage`,
 * le compteur « n/N image(s) embarquée(s) », et les avertissements après export.
 *
 * ⛔ AFFICHE (défaut [AFF-EXPORT], mesuré le 2026-08-05) : ce panneau n'était atteignable
 * qu'en mode Document, et il ne savait lire QUE des canevas 96 dpi. Sur une Affiche —
 * A4 à 300 dpi, 2480 × 3508 — `formatDePage` ne reconnaissait aucun format, retombait
 * sur une hauteur de page de 1123 px et débitait l'affiche en TROIS pages sur du papier
 * de 65,6 × 92,8 cm. La page est désormais reconnue comme un A4 AGRANDI
 * ({@link pageDeReference}) et la scène est ramenée dans le repère 96 dpi
 * ({@link ramenerAuRepere96}) avant d'être remise au moteur d'export — lequel
 * appartient à un autre propriétaire et n'est pas touché.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, FileDown, Printer, Image as ImageIcon, Loader2, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSmartboardKonvaStore } from '@/features/smartboard-konva-editor/store/useSmartboardKonvaStore';
import { useDocumentCoachStore } from '@/features/smartboard-konva-editor/store/useDocumentCoachStore';
import { getTemplateById } from '@/features/smartboard-konva-editor/lib/documentTemplateLibrary';
import {
  preparerExport,
  exporterPdf,
  exporterImpression,
} from '@/features/smartboard-konva-editor/lib/documentExport';
import { formatDepuisCanevas } from '@/features/smartboard-konva-editor/lib/documentPagination';
import {
  pageDeReference,
  ramenerAuRepere96,
  dpiDuCanevas,
} from '@/features/smartboard-konva-editor/components/echelleCanevasDocument';
/* Re-signeur du bucket PRIVÉ `smartboard-canvas` : sans lui, l'export ne récupère
   AUCUNE image dont le bitmap n'est plus dans le canevas (le src stocké est une URL
   publique qui répond 403 depuis le passage du bucket en privé). */
import { signSmartboardCanvasUrl } from '@/lib/smartboardCanvasUrl';

const VERDICTS = {
  propre: { label: 'Mise en page propre', cls: 'text-[#9cc48a]', icon: CheckCircle2 },
  a_corriger: { label: 'Points à corriger', cls: 'text-amber-300', icon: AlertTriangle },
  bloquant: { label: 'Défauts bloquants pour l’impression', cls: 'text-rose-300', icon: AlertTriangle },
  vide: { label: 'Document vide', cls: 'text-white/45', icon: Info },
  inconnu: { label: 'Verdict indisponible', cls: 'text-white/45', icon: Info },
};

const GRAVITE_CLS = {
  bloquant: 'border-rose-500/25 bg-rose-500/[0.07] text-rose-100/90',
  majeur: 'border-amber-500/25 bg-amber-500/[0.07] text-amber-100/90',
  mineur: 'border-white/[0.09] bg-white/[0.03] text-white/60',
  info: 'border-white/[0.07] bg-white/[0.02] text-white/45',
};

/**
 * Format d'UNE page dans le repère 96 dpi du moteur d'export (le canevas, lui, empile
 * toutes ses pages), et l'échelle qui sépare le canevas de ce repère.
 *
 * ⛔ ORDRE DES TESTS — le format 96 dpi EXACT d'abord : c'est le chemin du mode
 * Document, prouvé, et il doit rester bit à bit identique (échelle 1). Le format
 * AGRANDI ensuite : sans lui une Affiche 2480 × 3508 ne correspondait à rien et
 * repartait sur `Math.min(hauteurCanevas, 1123)`, soit trois pages fantômes.
 *
 * @returns {{ width:number, height:number, echelle:number, refId:string|null }}
 *          `width`/`height` sont en px @96 dpi — l'unité que `resoudreFormat` attend.
 */
function formatDePage(largeur, hauteurCanevas) {
  /* `formatDepuisCanevas` départage par la hauteur les deux formats larges de 794 px
     (A4 portrait / A5 paysage) : lu à la largeur seule, un document A5 paysage
     partait à l'impression sur des pages hautes de 1123 px au lieu de 559. */
  const trouve = formatDepuisCanevas(largeur, hauteurCanevas);
  if (trouve) return { width: largeur, height: trouve.hauteur, echelle: 1, refId: trouve.id };
  const ref = pageDeReference(largeur, hauteurCanevas);
  if (ref) return { width: ref.largeur, height: ref.hauteur, echelle: ref.echelle, refId: ref.id };
  /* Ni page papier ni page papier agrandie (Smartboard/Présentation 1920 × 1080) :
     le canevas EST la page, on la reporte telle quelle. */
  return { width: largeur, height: Math.min(hauteurCanevas, 1123), echelle: 1, refId: null };
}

const arr = (v) => Math.round(Number(v) || 0);

/** Poids lisible — c'est LA preuve qu'un PDF a bien embarqué ses images. */
function poids(octets) {
  const n = Number(octets);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function DocumentExportPanel({ open, onClose, titreDocument = '', docType = 'document' }) {
  const scenes = useSmartboardKonvaStore((s) => s.project?.scenes ?? []);
  const activeSceneId = useSmartboardKonvaStore((s) => s.project?.activeSceneId);
  const canvasW = useSmartboardKonvaStore((s) => s.project?.canvas?.width ?? 794);
  const canvasH = useSmartboardKonvaStore((s) => s.project?.canvas?.height ?? 1123);
  const canvasBg = useSmartboardKonvaStore((s) => s.project?.canvas?.background);

  /**
   * ⛔ MÊMES ENTRÉES QUE L'ONGLET ARCHITECT, sinon les deux critiques du même
   * document ne peuvent pas s'accorder : type détecté, modèle et `page_setup`
   * décident des marges retenues. `DocumentReviewPanel` compose exactement ce
   * triplet — le recopier ici est ce qui rend les deux verdicts comparables.
   */
  const detectedType = useDocumentCoachStore((s) => s.detectedType);
  const selectedTemplate = useDocumentCoachStore((s) => s.selectedTemplate);
  const documentPlan = useDocumentCoachStore((s) => s.documentPlan);
  const templateId = selectedTemplate?.id ?? documentPlan?.libraryTemplateId ?? null;

  const objetsScene = useMemo(
    () => scenes.find((s) => s.id === activeSceneId)?.objects ?? [],
    [scenes, activeSceneId],
  );
  const page = useMemo(() => formatDePage(canvasW, canvasH), [canvasW, canvasH]);
  const format = useMemo(() => {
    const modele = templateId ? getTemplateById(templateId) : null;
    return {
      width: page.width,
      height: page.height,
      fond: canvasBg,
      page_setup: modele?.page_setup ?? null,
    };
  }, [page, canvasBg, templateId]);

  /**
   * ⛔ LA SCÈNE EST RAMENÉE AU REPÈRE 96 dpi, pas seulement le format : les deux
   * doivent parler la même unité, sinon les objets d'une Affiche (x jusqu'à 2480)
   * seraient tracés hors d'une page de 794. Les identifiants sont conservés — c'est
   * par eux que `resoudreImages` retrouve les bitmaps déjà décodés dans le canevas.
   */
  const objets = useMemo(() => ramenerAuRepere96(objetsScene, page.echelle), [objetsScene, page.echelle]);
  const dpiCanevas = useMemo(() => Math.round(dpiDuCanevas(canvasW, canvasH)), [canvasW, canvasH]);

  const [rapport, setRapport] = useState(null);
  const [analyse, setAnalyse] = useState(false);
  const [erreur, setErreur] = useState('');
  const [busy, setBusy] = useState('');
  const [resultat, setResultat] = useState('');
  const [avertissementsExport, setAvertissementsExport] = useState([]);

  useEffect(() => {
    if (!open) return undefined;
    let vivant = true;
    setAnalyse(true);
    setErreur('');
    setResultat('');
    setAvertissementsExport([]);
    preparerExport(objets, {
      format,
      typeDoc: detectedType ?? 'document',
      templateId,
      /* Le nom de fichier ne suit PAS le type détecté : il resterait « invoice ». */
      nomFichier: titreDocument || docType || 'document',
      resoudreSrcImage: signSmartboardCanvasUrl,
    })
      .then((r) => { if (vivant) setRapport(r); })
      .catch((e) => { if (vivant) setErreur(e?.message ? String(e.message) : String(e)); })
      .finally(() => { if (vivant) setAnalyse(false); });
    return () => { vivant = false; };
  }, [open, objets, format, titreDocument, docType, detectedType, templateId]);

  const lancerPdf = useCallback(async () => {
    setBusy('pdf');
    setErreur('');
    setAvertissementsExport([]);
    try {
      const r = await exporterPdf(objets, {
        format,
        typeDoc: docType || 'document',
        nomFichier: titreDocument || undefined,
        resoudreSrcImage: signSmartboardCanvasUrl,
      });
      const p = poids(r.octets);
      const img = r.images?.total
        ? ` · ${r.images.dessinees}/${r.images.total} image(s) embarquée(s)`
        : '';
      setResultat(
        `${r.nomFichier} — ${r.pages} page(s), texte ${r.texteSelectionnable ? 'sélectionnable' : 'aplati en image'}`
        + `${img}${p ? ` · ${p}` : ''}.`,
      );
      /* Les avertissements de l'export étaient JETÉS : une image perdue ne se voyait
         nulle part, ni avant ni après. Ils s'affichent désormais avec le résultat. */
      setAvertissementsExport(r.avertissements ?? []);
    } catch (e) {
      setErreur(e?.message ? String(e.message) : String(e));
    } finally {
      setBusy('');
    }
  }, [objets, format, titreDocument, docType]);

  const lancerImpression = useCallback(async () => {
    setBusy('print');
    setErreur('');
    setAvertissementsExport([]);
    try {
      const r = await exporterImpression(objets, {
        format,
        typeDoc: docType || 'document',
        nomFichier: titreDocument || undefined,
        resoudreSrcImage: signSmartboardCanvasUrl,
      });
      setAvertissementsExport(r.avertissements ?? []);
      if (!r.ok) setErreur(r.raison || 'Impression indisponible.');
      else setResultat(`Aperçu d'impression ouvert (${r.pages} page(s)).`);
    } catch (e) {
      setErreur(e?.message ? String(e.message) : String(e));
    } finally {
      setBusy('');
    }
  }, [objets, format, titreDocument, docType]);

  if (!open) return null;

  const v = VERDICTS[rapport?.verdict ?? 'inconnu'] ?? VERDICTS.inconnu;
  const VIcon = v.icon;
  const constats = Array.isArray(rapport?.diagnostic?.constats) ? rapport.diagnostic.constats : [];

  return (
    <div className="fixed inset-0 z-[400] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="mt-10 w-[min(560px,100%)] rounded-2xl border border-white/[0.12] bg-[#1f1e1c] shadow-[0_24px_70px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
          <FileDown className="h-4 w-4 text-[#e0a458]" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-white/85">Exporter le document</p>
            <p className="text-[10px] text-white/35">
              {format.width} × {format.height} px par page · {rapport?.nbPages ?? '—'} page(s) · {rapport?.nbObjets ?? 0} objet(s)
              {page.echelle > 1 ? (
                <>
                  {' '}· canevas {arr(canvasW)} × {arr(canvasH)} @{dpiCanevas} dpi,
                  ramené à l&apos;échelle 1/{page.echelle.toFixed(3)}
                </>
              ) : null}
              {rapport?.images?.total ? (
                <>
                  {' '}·{' '}
                  <span className={rapport.images.integrees < rapport.images.total ? 'text-rose-300' : 'text-[#9cc48a]'}>
                    {rapport.images.integrees}/{rapport.images.total} image(s) embarquée(s)
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <button
            type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/35 hover:bg-white/10 hover:text-white/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[62vh] space-y-3 overflow-y-auto px-4 py-3">
          {/* ── Critique AVANT export ── */}
          <div className="rounded-xl border border-white/[0.09] bg-white/[0.02] p-3">
            <div className="flex items-center gap-2">
              {analyse ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" /> : <VIcon className={cn('h-3.5 w-3.5', v.cls)} />}
              <p className={cn('text-[11.5px] font-semibold', analyse ? 'text-white/50' : v.cls)}>
                {analyse ? 'Relecture de la mise en page…' : v.label}
              </p>
              {!analyse && rapport ? (
                <span className="ml-auto text-[9px] text-white/35">
                  {rapport.bloquants} bloquant(s) · {rapport.majeurs} majeur(s)
                </span>
              ) : null}
            </div>

            {/* Le CADRE jugé, écrit noir sur blanc : c'est lui qui décidait des
                « marges déclarées 0/0/0/0 px » quand l'export inventait ses marges. */}
            {!analyse && rapport?.diagnostic?.cadre ? (
              <p className="mt-1.5 text-[9px] leading-snug text-white/30">
                Cadre jugé : page {arr(rapport.diagnostic.cadre.page.width)} × {arr(rapport.diagnostic.cadre.page.height)} px
                {rapport.diagnostic.cadre.marges ? (
                  <>
                    {' '}· marges {arr(rapport.diagnostic.cadre.marges.top)}/{arr(rapport.diagnostic.cadre.marges.right)}/
                    {arr(rapport.diagnostic.cadre.marges.bottom)}/{arr(rapport.diagnostic.cadre.marges.left)} px (H/D/B/G)
                  </>
                ) : null}
                {' '}· {rapport.diagnostic.cadre.nbPages} page(s) relues une à une.
              </p>
            ) : null}

            {rapport?.diagnosticIndisponible ? (
              <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-2 py-1.5 text-[9.5px] leading-snug text-amber-100/85">
                {rapport.diagnosticIndisponible} — l&apos;export reste possible, mais rien n&apos;a été relu.
              </p>
            ) : null}

            {constats.length ? (
              <ul className="mt-2 space-y-1.5">
                {constats.slice(0, 8).map((c, i) => (
                  <li key={c.regle ? `${c.regle}-${i}` : i} className={cn('rounded-lg border px-2 py-1.5 text-[9.5px] leading-snug', GRAVITE_CLS[c.gravite] ?? GRAVITE_CLS.info)}>
                    <p className="font-semibold">{c.titre}</p>
                    {c.mesure ? <p className="mt-0.5 opacity-75">{c.mesure}</p> : null}
                  </li>
                ))}
                {constats.length > 8 ? (
                  <li className="text-[9px] text-white/30">+ {constats.length - 8} autre(s) constat(s).</li>
                ) : null}
              </ul>
            ) : !analyse && rapport ? (
              <p className="mt-2 text-[9.5px] text-white/35">Aucun défaut de mise en page relevé.</p>
            ) : null}

            {(rapport?.avertissements ?? []).map((a) => (
              <p key={a} className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-2 py-1.5 text-[9.5px] leading-snug text-amber-100/80">
                {a}
              </p>
            ))}
          </div>

          <p className="text-[9.5px] leading-snug text-white/35">
            Ces constats sont informatifs : vous pouvez exporter malgré eux. Le PDF est vectoriel —
            le texte y reste sélectionnable, mais les polices web du canevas retombent sur les polices
            standard du PDF (le dessin des lettres change légèrement).
          </p>

          {erreur ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 text-[10px] text-rose-100/90">{erreur}</p>
          ) : null}
          {resultat ? (
            <p className="rounded-lg border border-[#5a8f52]/30 bg-[#5a8f52]/10 px-2.5 py-2 text-[10px] text-[#c3e0b4]">{resultat}</p>
          ) : null}
          {/* Ce que l'export a RÉELLEMENT perdu, dit après coup et pas seulement avant. */}
          {avertissementsExport.map((a) => (
            <p key={a} className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-2.5 py-2 text-[9.5px] leading-snug text-amber-100/85">
              {a}
            </p>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.08] px-4 py-3">
          <button
            type="button" onClick={() => void lancerPdf()} disabled={Boolean(busy) || analyse}
            className="flex items-center gap-1.5 rounded-xl border border-[#d4924a]/35 bg-[#d4924a]/15 px-3 py-2 text-[11px] font-semibold text-[#ecc98f] transition hover:bg-[#d4924a]/25 disabled:opacity-40"
          >
            {busy === 'pdf' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
            Exporter le PDF
          </button>
          <button
            type="button" onClick={() => void lancerImpression()} disabled={Boolean(busy) || analyse}
            className="flex items-center gap-1.5 rounded-xl border border-white/[0.12] px-3 py-2 text-[11px] font-medium text-white/60 transition hover:border-white/25 hover:text-white/85 disabled:opacity-40"
          >
            {busy === 'print' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
            Imprimer
          </button>
          <span className="flex items-center gap-1 text-[9px] text-white/25">
            <ImageIcon className="h-3 w-3" />
            PNG : indisponible ici (il réclame le canevas Konva, pas les objets).
          </span>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-[11px] text-white/40 hover:text-white/70">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
