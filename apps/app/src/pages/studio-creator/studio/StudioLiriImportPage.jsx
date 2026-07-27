/**
 * StudioLiriImportPage — Import Studio LIRI
 * Route : /studio/liri/import
 *
 * ── CE QUI A CHANGÉ ET POURQUOI ─────────────────────────────────────────────────
 * Cette page annonçait SIX types d'import. Un seul faisait un vrai travail (« Document
 * de cours » → extraction de texte → Masterclass Factory). Les cinq autres jouaient une
 * fausse analyse : `setTimeout(…, 2200)` puis des chiffres écrits en dur (« 10 sections
 * détectées », « Images : 3 »), quel que soit le fichier — y compris pour un fichier vide.
 * L'étape « Destination » proposait ensuite quatre cibles dont trois se contentaient de
 * naviguer en JETANT le fichier.
 *
 * On garde donc TROIS types, ceux derrière lesquels un moteur existe déjà (voir
 * `@/lib/studioImportPipeline`), et on affiche les trois autres comme non disponibles,
 * avec la raison. Moins, mais vrai.
 *
 * Le parcours passe de 5 étapes à 3 : Type → Traitement (le vrai) → Ouverture. La
 * destination n'est plus un choix décoratif : elle découle du type, parce que c'est le
 * seul outil qui sait consommer ce contenu.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronRight, CheckCircle2, Loader2, ArrowRight, Upload,
  FileText, Image as ImageIcon, FolderOpen, AlertTriangle, RefreshCw, Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import StudioDesignerLikeShell from '@/components/liri/liri-ecosystem/StudioDesignerLikeShell';
import {
  IMPORT_LIMITS,
  formatBytes,
  importCourseDocument,
  importLiriProject,
  importVisualAsset,
} from '@/lib/studioImportPipeline';

/* ─── Palette (charte LIRI — tout chaud) ─────────────────────────────────────── */

const PANEL = '#30302e';
const FIELD = '#2b2a27';
const LINE = 'rgba(245,244,238,0.09)';
const INK = '#f5f4ee';
const INK_SOFT = 'rgba(245,244,238,0.62)';
const INK_FAINT = 'rgba(245,244,238,0.42)';
const CORAL = '#d97757';
const CORAL_HOVER = '#e08a5f';
/** Encre SOMBRE sur aplat corail : 5,34:1 (le blanc n'y est qu'à 2,83:1). */
const ON_CORAL = '#1f1e1c';
const GOLD = '#e6b878';

/* ─── Les trois imports RÉELS ────────────────────────────────────────────────── */

const REAL_TYPES = [
  {
    id: 'document',
    label: 'Document de cours',
    icon: FileText,
    desc: 'PDF · Word · .txt · .md',
    accept: '.pdf,.docx,.txt,.md',
    exts: ['pdf', 'docx', 'txt', 'md', 'text', 'markdown'],
    targetLabel: 'Masterclass Factory',
    what: `Le texte est extrait dans le navigateur (pdf.js / mammoth), puis la Factory s'ouvre pré-remplie. ${formatBytes(IMPORT_LIMITS.documentBytes)} maximum.`,
  },
  {
    id: 'visual',
    label: 'Ressource visuelle',
    icon: ImageIcon,
    desc: 'PNG · JPEG · WebP · GIF · SVG',
    accept: '.png,.jpg,.jpeg,.webp,.gif,.svg',
    exts: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'],
    targetLabel: 'SmartBoard Designer',
    what: `L'image est téléversée dans votre espace, rangée dans la galerie Images du Designer, puis posée sur un nouveau document. ${formatBytes(IMPORT_LIMITS.visualBytes)} maximum (plafond du stockage).`,
  },
  {
    id: 'project',
    label: 'Projet LIRI',
    icon: FolderOpen,
    desc: 'Export .json du Designer',
    accept: '.json',
    exts: ['json'],
    targetLabel: 'SmartBoard Designer',
    what: `Workspace LIRI complet ou projet Konva : le fichier est validé, enregistré dans vos workspaces, puis ouvert. ${formatBytes(IMPORT_LIMITS.projectBytes)} maximum.`,
  },
];

/**
 * Types retirés du parcours : aucun moteur ne sait les consommer aujourd'hui.
 * On les laisse VISIBLES avec la raison plutôt que de les faire disparaître en silence —
 * ils sont encore annoncés ailleurs (hub Studio, bibliothèque) et l'utilisateur mérite de
 * savoir pourquoi le bouton ne fait rien plutôt que de tomber sur une fausse analyse.
 */
const SOON_TYPES = [
  {
    id: 'template',
    label: 'Gabarit / template',
    reason:
      'Les modèles du Designer sont écrits en dur dans l’application : rien ne sait encore ingérer un fichier de gabarit. Un .json contenant des scènes passe déjà par « Projet LIRI ».',
  },
  {
    id: 'lut',
    label: 'LUT & preset colorimétrique',
    reason:
      'Aucun moteur .cube / .3dl dans le rendu : la post-production l’annonce elle-même — LUT, calibration et HSL sont hors périmètre.',
  },
  {
    id: 'pack',
    label: 'Pack communautaire (.zip)',
    reason:
      'Aucune bibliothèque de décompression n’est embarquée : une archive ne peut pas être ouverte ici.',
  },
];

const ALL_ACCEPT = REAL_TYPES.map((t) => t.accept).join(',');

/** Liens entrants du hub Studio : /studio/liri/import?type=asset|document|template|pack */
const QUERY_TYPE_ALIASES = {
  document: 'document',
  doc: 'document',
  asset: 'visual',
  visual: 'visual',
  image: 'visual',
  project: 'project',
  projet: 'project',
  workspace: 'project',
};

const STEPS = [
  { id: 1, label: 'Type' },
  { id: 2, label: 'Traitement' },
  { id: 3, label: 'Ouverture' },
];

/* ─── Aides ──────────────────────────────────────────────────────────────────── */

function extensionOf(file) {
  const name = typeof file?.name === 'string' ? file.name : '';
  const dot = name.lastIndexOf('.');
  return dot > -1 ? name.slice(dot + 1).toLowerCase() : '';
}

/** Glisser-déposer : on devine le type d'après l'extension réelle du fichier. */
function inferTypeFromFile(file) {
  const ext = extensionOf(file);
  return REAL_TYPES.find((t) => t.exts.includes(ext)) || null;
}

function unsupportedMessage(file) {
  const ext = extensionOf(file);
  if (['zip', 'rar', '7z'].includes(ext)) {
    return 'Les archives ne sont pas décompressées ici (voir « Pas encore disponibles »).';
  }
  if (['cube', '3dl'].includes(ext)) {
    return 'Les LUT ne sont pas encore prises en charge (voir « Pas encore disponibles »).';
  }
  if (['mp4', 'mov', 'webm', 'avi'].includes(ext)) {
    return 'La vidéo ne passe pas par cet import : elle se dépose dans la Vidéothèque ou la post-production.';
  }
  return `Format « .${ext || '?'} » non reconnu. Acceptés : PDF, Word, .txt, .md, PNG, JPEG, WebP, GIF, SVG, .json.`;
}

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, i) => (
        <React.Fragment key={step.id}>
          <div className="flex items-center gap-1.5">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all"
              style={
                step.id < current
                  ? { background: 'rgba(230,184,120,0.20)', color: GOLD }
                  : step.id === current
                    ? { background: CORAL, color: ON_CORAL }
                    : { background: 'rgba(245,244,238,0.08)', color: INK_FAINT }
              }
            >
              {step.id < current ? '✓' : step.id}
            </div>
            <span
              className="hidden text-[11px] transition-colors sm:block"
              style={{ color: step.id === current ? INK : INK_FAINT }}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 flex-shrink-0" style={{ color: INK_FAINT }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

/** Avis en palette chaude — jamais de rouge criard, y compris pour une erreur. */
function Notice({ tone = 'warn', children }) {
  const isError = tone === 'error';
  return (
    <div
      className="flex items-start gap-2 rounded-xl px-3 py-2.5"
      style={{
        background: isError ? 'rgba(217,119,87,0.12)' : 'rgba(217,154,78,0.12)',
        border: `1px solid ${isError ? 'rgba(217,119,87,0.35)' : 'rgba(217,154,78,0.30)'}`,
      }}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: isError ? CORAL_HOVER : GOLD }} />
      <p className="text-[12px] leading-relaxed" style={{ color: isError ? '#f0b79c' : GOLD }}>
        {children}
      </p>
    </div>
  );
}

function FactRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5" style={{ borderBottom: `1px solid ${LINE}` }}>
      <span className="text-[11px] uppercase tracking-[0.1em]" style={{ color: INK_FAINT }}>{label}</span>
      <span className="text-right text-[12px] font-medium" style={{ color: INK }}>{value}</span>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */

export default function StudioLiriImportPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileRef = useRef(null);

  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState(null);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [soonOpen, setSoonOpen] = useState(null);

  /* Lien entrant `?type=` : on présélectionne quand le type existe pour de bon, et on
     explique quand il pointe vers un type retiré (template, pack…). */
  useEffect(() => {
    const raw = String(searchParams.get('type') || '').toLowerCase();
    if (!raw) return;
    const mapped = QUERY_TYPE_ALIASES[raw];
    if (mapped) {
      const t = REAL_TYPES.find((x) => x.id === mapped);
      if (t) setSelectedType(t);
      return;
    }
    const soon = SOON_TYPES.find((x) => x.id === raw);
    if (soon) setSoonOpen(soon.id);
  }, [searchParams]);

  const runImport = useCallback(async (f, type) => {
    setFile(f);
    setSelectedType(type);
    setError('');
    setResult(null);
    setStep(2);
    try {
      let out;
      if (type.id === 'document') out = await importCourseDocument(f);
      else if (type.id === 'visual') out = await importVisualAsset(f);
      else out = await importLiriProject(f);
      setResult({ typeId: type.id, ...out });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import impossible.');
    } finally {
      setStep(3);
    }
  }, []);

  const handlePicked = useCallback(
    (f, forcedType) => {
      if (!f) return;
      const type = forcedType || inferTypeFromFile(f);
      if (!type) {
        setFile(f);
        setSelectedType(null);
        setResult(null);
        setError(unsupportedMessage(f));
        setStep(3);
        return;
      }
      // Un fichier déposé qui ne colle pas au type cliqué : on suit le FICHIER, pas le clic.
      const coherent = type.exts.includes(extensionOf(f)) ? type : inferTypeFromFile(f);
      if (!coherent) {
        setFile(f);
        setResult(null);
        setError(unsupportedMessage(f));
        setStep(3);
        return;
      }
      runImport(f, coherent);
    },
    [runImport],
  );

  const onInputChange = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    handlePicked(f, selectedType);
  };

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer?.files?.[0];
      handlePicked(f, null);
    },
    [handlePicked],
  );

  const reset = () => {
    setStep(1);
    setSelectedType(null);
    setFile(null);
    setResult(null);
    setError('');
  };

  const openTarget = () => {
    if (result?.openPath) navigate(result.openPath);
  };

  const recapFacts = useMemo(() => {
    if (!result) return [];
    if (result.typeId === 'document') {
      return [
        { label: 'Fichier', value: result.fileName },
        { label: 'Texte extrait', value: `${result.chars.toLocaleString('fr-FR')} caractères` },
        {
          label: 'Envoyé à la Factory',
          value: result.truncated
            ? `${IMPORT_LIMITS.factoryChars.toLocaleString('fr-FR')} premiers caractères`
            : 'Totalité du texte',
        },
      ];
    }
    if (result.typeId === 'visual') {
      return [
        { label: 'Fichier', value: `${file?.name || '—'} · ${formatBytes(file?.size || 0)}` },
        {
          label: 'Dimensions source',
          value: result.natural ? `${result.natural.width} × ${result.natural.height} px` : 'non détectées',
        },
        { label: 'Posée sur le canevas', value: `${result.placed.width} × ${result.placed.height} px` },
        { label: 'Galerie Images', value: result.inGallery ? 'Ajoutée' : 'Non ajoutée' },
        { label: 'Document créé', value: result.workspaceId ? 'Oui' : 'Non' },
      ];
    }
    return [
      { label: 'Fichier', value: `${file?.name || '—'} · ${formatBytes(file?.size || 0)}` },
      { label: 'Type reconnu', value: result.kind === 'workspace' ? 'Workspace LIRI complet' : 'Projet Konva' },
      { label: 'Scènes', value: String(result.summary?.konvaSceneCount ?? 0) },
      { label: 'Objets sur le canevas', value: String(result.summary?.elementCount ?? 0) },
      { label: 'Slides au plan', value: String(result.summary?.slidePlanCount ?? 0) },
      { label: 'Enregistré sous', value: result.title },
    ];
  }, [result, file]);

  return (
    <StudioDesignerLikeShell
      railActiveKey="import"
      pageLabel="Import"
      pageAccent="emerald"
      TitleIcon={Upload}
      titleLine="Communautaire"
    >
      <div className="mx-auto max-w-3xl px-6 py-8">

        {/* En-tête */}
        <div className="mb-8">
          <h2 className="mb-1 text-[20px] font-bold" style={{ color: INK }}>Importer une ressource</h2>
          <p className="mb-5 text-[13px]" style={{ color: INK_SOFT }}>
            Document de cours · ressource visuelle · projet LIRI. Chaque import est réellement lu ou
            téléversé, puis ouvert dans l’outil qui sait le consommer.
          </p>
          <StepIndicator current={step} />
        </div>

        <AnimatePresence mode="wait">

          {/* ── Étape 1 : type ── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <div className="rounded-2xl p-6" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
                <h3 className="mb-4 text-[15px] font-semibold" style={{ color: INK }}>
                  Que voulez-vous importer ?
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {REAL_TYPES.map((type) => {
                    const Icon = type.icon;
                    const active = selectedType?.id === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => {
                          setSelectedType(type);
                          fileRef.current?.click();
                        }}
                        className="flex flex-col items-start gap-2 rounded-xl p-4 text-left transition-all"
                        style={{
                          background: active ? 'rgba(217,119,87,0.15)' : FIELD,
                          border: `1px solid ${active ? 'rgba(217,119,87,0.40)' : LINE}`,
                        }}
                      >
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-lg"
                          style={{ background: 'rgba(217,119,87,0.15)' }}
                        >
                          <Icon className="h-4 w-4" style={{ color: CORAL_HOVER }} />
                        </span>
                        <span className="text-[12px] font-semibold" style={{ color: INK }}>{type.label}</span>
                        <span className="text-[10px]" style={{ color: INK_SOFT }}>{type.desc}</span>
                        <span className="mt-1 text-[10px] leading-snug" style={{ color: INK_FAINT }}>
                          → {type.targetLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selectedType && (
                  <p className="mt-4 text-[11px] leading-relaxed" style={{ color: INK_SOFT }}>
                    {selectedType.what}
                  </p>
                )}
              </div>

              {/* Zone de dépôt — réellement branchée (onDrop), le type est déduit du fichier */}
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl py-10 transition-all"
                style={{
                  border: `2px dashed ${dragOver ? CORAL : LINE}`,
                  background: dragOver ? 'rgba(217,119,87,0.08)' : 'transparent',
                }}
              >
                <Upload className="h-8 w-8" style={{ color: dragOver ? CORAL : INK_FAINT }} />
                <div className="text-center">
                  <div className="text-[13px] font-medium" style={{ color: INK_SOFT }}>
                    Glissez-déposez un fichier
                  </div>
                  <div className="mt-1 text-[11px]" style={{ color: INK_FAINT }}>
                    le type est reconnu automatiquement
                  </div>
                </div>
              </div>

              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept={selectedType?.accept || ALL_ACCEPT}
                onChange={onInputChange}
              />

              {/* Ce qui n'existe pas encore — dit franchement, avec la raison */}
              <div className="mt-6 rounded-2xl p-5" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
                <div className="mb-3 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" style={{ color: GOLD }} />
                  <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: GOLD }}>
                    Pas encore disponibles
                  </h3>
                </div>
                <div className="flex flex-col gap-2">
                  {SOON_TYPES.map((s) => {
                    const open = soonOpen === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSoonOpen(open ? null : s.id)}
                        className="rounded-xl px-3 py-2.5 text-left transition-all"
                        style={{ background: FIELD, border: `1px solid ${LINE}` }}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-[12px] font-medium" style={{ color: INK_SOFT }}>{s.label}</span>
                          <span
                            className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em]"
                            style={{ background: 'rgba(230,184,120,0.15)', color: GOLD }}
                          >
                            à venir
                          </span>
                          <ChevronRight
                            className={cn('ml-auto h-3.5 w-3.5 transition-transform', open && 'rotate-90')}
                            style={{ color: INK_FAINT }}
                          />
                        </span>
                        {open && (
                          <span className="mt-2 block text-[11px] leading-relaxed" style={{ color: INK_FAINT }}>
                            {s.reason}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Étape 2 : traitement réel ── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center gap-4 rounded-2xl p-8 text-center"
              style={{ background: PANEL, border: `1px solid ${LINE}` }}
            >
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ background: 'rgba(217,119,87,0.15)', border: '1px solid rgba(217,119,87,0.30)' }}
              >
                <Loader2 className="h-7 w-7 animate-spin" style={{ color: CORAL_HOVER }} />
              </div>
              <div>
                <h3 className="mb-1 text-[15px] font-semibold" style={{ color: INK }}>
                  {selectedType?.id === 'document' && 'Extraction du texte…'}
                  {selectedType?.id === 'visual' && 'Téléversement de l’image…'}
                  {selectedType?.id === 'project' && 'Lecture et validation du projet…'}
                </h3>
                <p className="text-[13px]" style={{ color: INK_SOFT }}>
                  {selectedType?.id === 'visual'
                    ? 'Envoi vers votre espace de stockage, puis création du document.'
                    : 'Traitement dans le navigateur — rien n’est inventé, tout vient du fichier.'}
                </p>
              </div>
              {file && (
                <div
                  className="rounded-xl px-4 py-2.5 text-[12px]"
                  style={{ background: FIELD, border: `1px solid ${LINE}`, color: INK_SOFT }}
                >
                  {file.name} · {formatBytes(file.size)}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Étape 3 : ouverture (ou échec expliqué) ── */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-4"
            >
              {error ? (
                <div className="rounded-2xl p-6" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
                  <h3 className="mb-3 text-[15px] font-semibold" style={{ color: INK }}>Import interrompu</h3>
                  <Notice tone="error">{error}</Notice>
                  {file && (
                    <p className="mt-3 text-[11px]" style={{ color: INK_FAINT }}>
                      Fichier concerné : {file.name} · {formatBytes(file.size)}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl p-6" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
                  <div className="mb-5 flex items-start gap-3">
                    <span
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                      style={{ background: 'rgba(230,184,120,0.15)' }}
                    >
                      <CheckCircle2 className="h-5 w-5" style={{ color: GOLD }} />
                    </span>
                    <div>
                      <h3 className="text-[15px] font-semibold" style={{ color: INK }}>Import effectué</h3>
                      <p className="text-[12px]" style={{ color: INK_SOFT }}>
                        Ces chiffres viennent du fichier, pas d’une estimation.
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 flex flex-col">
                    {recapFacts.map((f) => (
                      <FactRow key={f.label} label={f.label} value={f.value} />
                    ))}
                  </div>

                  {result?.warning ? <Notice tone="warn">{result.warning}</Notice> : null}
                  {result?.typeId === 'document' && result?.truncated ? (
                    <Notice tone="warn">
                      Le document dépasse la fenêtre de pré-remplissage : seuls les{' '}
                      {IMPORT_LIMITS.factoryChars.toLocaleString('fr-FR')} premiers caractères partent
                      dans la Factory. Découpez le document si la suite compte.
                    </Notice>
                  ) : null}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={reset}
                  className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[12px] transition-all"
                  style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {error ? 'Choisir un autre fichier' : 'Importer autre chose'}
                </button>
                {!error && result?.openPath && (
                  <button
                    type="button"
                    onClick={openTarget}
                    onMouseEnter={(e) => { e.currentTarget.style.background = CORAL_HOVER; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = CORAL; }}
                    className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-[13px] font-semibold transition-all"
                    style={{ background: CORAL, color: ON_CORAL }}
                  >
                    Ouvrir dans {selectedType?.targetLabel}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </StudioDesignerLikeShell>
  );
}
