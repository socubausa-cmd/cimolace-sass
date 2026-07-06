/**
 * StudioLiriImportPage — Workflow d'import communautaire LIRI
 * Route : /studio/liri/import
 *
 * Wizard 5 étapes : Choix type → Analyse → Prévisualisation → Destination → Validation
 */

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileUp, Package, BookOpen, Image, Layers, FolderOpen,
  ChevronRight, CheckCircle2, Loader2, ArrowRight,
  GraduationCap, Brain, LayoutGrid, Library, Upload,
  FileText, AlertCircle, Sparkles, RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { extractTextFromFile } from '@/lib/extractDocumentText';
import StudioDesignerLikeShell from '@/components/liri/liri-ecosystem/StudioDesignerLikeShell';

// ─── Import types ────────────────────────────────────────────────────────────

const IMPORT_TYPES = [
  {
    id: 'document',
    label: 'Document de cours',
    icon: FileText,
    desc: 'PDF · Word · texte · notes → cours Précepteur',
    accent: 'violet',
    accept: '.pdf,.docx,.txt,.md,.text',
  },
  {
    id: 'visual',
    label: 'Ressource visuelle',
    icon: Image,
    desc: 'Image · SVG · illustration',
    accent: 'cyan',
    accept: '.png,.jpg,.jpeg,.svg,.webp',
  },
  {
    id: 'template',
    label: 'Template',
    icon: BookOpen,
    desc: 'Modèle JSON · preset SmartBoard',
    accent: 'blue',
    accept: '.json',
  },
  {
    id: 'project',
    label: 'Projet LIRI',
    icon: FolderOpen,
    desc: 'Workspace exporté · projet partiel',
    accent: 'amber',
    accept: '.json,.zip',
  },
  {
    id: 'lut',
    label: 'LUT & Preset',
    icon: Layers,
    desc: 'Style visuel · filtre colorimétrique',
    accent: 'purple',
    accept: '.json,.cube,.3dl',
  },
  {
    id: 'pack',
    label: 'Pack communautaire',
    icon: Package,
    desc: 'Collection complète zippée',
    accent: 'emerald',
    accept: '.zip',
  },
];

const DESTINATIONS = [
  { id: 'formation', label: 'Formation Builder', icon: GraduationCap, href: '/studio/liri/formation', accent: 'blue' },
  { id: 'cours', label: 'Course Builder', icon: Brain, href: '/studio/liri/cours', accent: 'amber' },
  { id: 'designer', label: 'SmartBoard Designer', icon: LayoutGrid, href: '/studio/smartboard-designer', accent: 'cyan' },
  { id: 'bibliotheque', label: 'Bibliothèque', icon: Library, href: '/studio/liri/bibliotheque', accent: 'emerald' },
];

const ACCENT_MAP = {
  violet: { text: 'text-[#e08a5f]', bg: 'bg-[#d97757]/15', border: 'border-[#d97757]/30', glow: 'shadow-[0_0_20px_rgba(217,119,87,0.25)]' },
  cyan: { text: 'text-[#e0a458]', bg: 'bg-[#d4924a]/15', border: 'border-[#d4924a]/30', glow: 'shadow-[0_0_20px_rgba(227,170,107,0.25)]' },
  blue: { text: 'text-[#e0a458]', bg: 'bg-[#d4924a]/15', border: 'border-[#d4924a]/30', glow: 'shadow-[0_0_20px_rgba(207,122,82,0.25)]' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', glow: 'shadow-[0_0_20px_rgba(245,158,11,0.25)]' },
  purple: { text: 'text-[#e08a5f]', bg: 'bg-[#d97757]/15', border: 'border-[#d97757]/30', glow: 'shadow-[0_0_20px_rgba(168,85,247,0.25)]' },
  emerald: { text: 'text-[#7bb06a]', bg: 'bg-[#5a8f52]/15', border: 'border-[#5a8f52]/30', glow: 'shadow-[0_0_20px_rgba(207,128,89,0.25)]' },
};

// ─── Wizard steps ────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Type' },
  { id: 2, label: 'Analyse' },
  { id: 3, label: 'Prévisualisation' },
  { id: 4, label: 'Destination' },
  { id: 5, label: 'Validation' },
];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, i) => (
        <React.Fragment key={step.id}>
          <div className="flex items-center gap-1.5">
            <div className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all',
              step.id < current
                ? 'bg-[#5a8f52]/25 text-[#9cc48a]'
                : step.id === current
                  ? 'bg-[#c96544] text-white shadow-[0_0_10px_rgba(217,119,87,0.4)]'
                  : 'bg-white/10 text-white/25',
            )}>
              {step.id < current ? '✓' : step.id}
            </div>
            <span className={cn(
              'text-[11px] transition-colors hidden sm:block',
              step.id === current ? 'text-white/80 font-medium' : 'text-white/25',
            )}>
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <ChevronRight className="h-3 w-3 flex-shrink-0 text-white/15" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StudioLiriImportPage() {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState(null);
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [destination, setDestination] = useState(null);

  const handleFileChange = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setFile(f);

    // « Document de cours » = flux RÉEL : on EXTRAIT le texte (PDF/texte) et on l'envoie,
    // pré-rempli, à la Masterclass Factory — d'où on exporte le « Cours numérique (Précepteur) ».
    if (selectedType?.id === 'document') {
      setStep(2);
      setAnalyzing(true);
      try {
        const text = await extractTextFromFile(f);
        if (text.trim()) {
          window.localStorage.setItem('masterclass:prefillRawText', text.slice(0, 40000));
          navigate('/dashboard/tools/masterclass-factory');
          return;
        }
        setAnalysis({
          type: 'document', compat: 'partial', usage: 'Masterclass Factory (Précepteur)', elements: [],
          limits: 'Aucun texte lisible (PDF scanné ?). Ouvre la Factory et copie-colle le texte.',
        });
      } catch {
        setAnalysis({
          type: 'document', compat: 'partial', usage: 'Masterclass Factory (Précepteur)', elements: [],
          limits: 'Lecture impossible. Formats acceptés : PDF, Word (.docx), .txt, .md.',
        });
      }
      setAnalyzing(false);
      setStep(3);
      return;
    }

    // Autres types (visuel · template · projet · LUT · pack) : maquette de parcours (roadmap).
    setStep(2);
    setAnalyzing(true);
    setTimeout(() => {
      setAnalysis({
        type: selectedType?.id || 'document',
        compat: 'high',
        usage: 'SmartBoard Designer · Course Builder',
        elements: ['Texte structuré', 'Titre de cours', '10 sections détectées', 'Images : 3'],
        limits: 'Les images nécessiteront un repositionnement manuel.',
      });
      setAnalyzing(false);
      setStep(3);
    }, 2200);
  };

  const reset = () => {
    setStep(1);
    setSelectedType(null);
    setFile(null);
    setAnalysis(null);
    setDestination(null);
    setAnalyzing(false);
  };

  const handleDestinationSelect = (dest) => {
    setDestination(dest);
    setStep(5);
  };

  const handleConfirm = () => {
    if (destination) navigate(destination.href);
  };

  return (
    <StudioDesignerLikeShell
      railActiveKey="import"
      pageLabel="Import"
      pageAccent="emerald"
      TitleIcon={Upload}
      titleLine="Communautaire"
    >
      <div className="mx-auto max-w-3xl px-6 py-8">

        {/* Header + Stepper */}
        <div className="mb-8">
          <h2 className="text-[20px] font-bold text-white mb-1">Importer une ressource</h2>
          <p className="text-[13px] text-white/40 mb-5">
            Document · template · projet · asset visuel · pack communautaire
          </p>
          <StepIndicator current={step} />
        </div>

        <AnimatePresence mode="wait">

          {/* ── Étape 1 : Choix du type ── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <h3 className="text-[15px] font-semibold text-white mb-4">Quel type de ressource importez-vous ?</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {IMPORT_TYPES.map((type) => {
                    const Icon = type.icon;
                    const c = ACCENT_MAP[type.accent] || ACCENT_MAP.violet;
                    return (
                      <button
                        key={type.id}
                        onClick={() => {
                          setSelectedType(type);
                          fileRef.current?.click();
                        }}
                        className={cn(
                          'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all hover:border-white/20 hover:bg-white/[0.05]',
                          selectedType?.id === type.id ? [c.border, c.bg, c.glow] : 'border-white/[0.07] bg-white/[0.02]',
                        )}
                      >
                        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', c.bg)}>
                          <Icon className={cn('h-4 w-4', c.text)} />
                        </div>
                        <div>
                          <div className="text-[12px] font-semibold text-white/80">{type.label}</div>
                          <div className="text-[10px] text-white/35 mt-0.5">{type.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Drop zone */}
              <div
                className="mt-4 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/10 py-10 cursor-pointer transition-all hover:border-[#d97757]/30 hover:bg-[#d97757]/[0.03]"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-white/20" />
                <div className="text-center">
                  <div className="text-[13px] font-medium text-white/50">Glissez-déposez un fichier</div>
                  <div className="text-[11px] text-white/25 mt-1">ou cliquez pour sélectionner</div>
                </div>
              </div>

              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept={selectedType?.accept || '*'}
                onChange={handleFileChange}
              />
            </motion.div>
          )}

          {/* ── Étape 2 : Analyse ── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 flex flex-col items-center text-center gap-4"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#d97757]/15 border border-[#d97757]/25">
                <Loader2 className="h-7 w-7 text-[#e08a5f] animate-spin" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-white mb-1">Analyse en cours...</h3>
                <p className="text-[13px] text-white/40">
                  LIRI détecte le type, la compatibilité et les éléments récupérables.
                </p>
              </div>
              {file && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[12px] text-white/50">
                  {file.name}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Étape 3 : Prévisualisation ── */}
          {step === 3 && analysis && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-4"
            >
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h3 className="text-[15px] font-semibold text-white mb-1">Prévisualisation</h3>
                    <p className="text-[12px] text-white/40">{file?.name}</p>
                  </div>
                  <span className={cn('rounded-full border px-3 py-1 text-[11px] font-medium',
                    analysis.compat === 'high' ? 'bg-[#5a8f52]/15 border-[#5a8f52]/25 text-[#7bb06a]' : 'bg-amber-500/15 border-amber-500/25 text-amber-400',
                  )}>
                    {analysis.compat === 'high' ? 'Haute compatibilité' : 'Compatibilité partielle'}
                  </span>
                </div>

                {/* Usage recommandé */}
                <div className="mb-4">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-white/30 mb-2">Usage recommandé</div>
                  <div className="text-[13px] text-[#e8a97f]">{analysis.usage}</div>
                </div>

                {/* Éléments récupérables */}
                <div className="mb-4">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-white/30 mb-2">Éléments récupérables</div>
                  <div className="flex flex-wrap gap-2">
                    {analysis.elements.map((el) => (
                      <span key={el} className="flex items-center gap-1 rounded-lg border border-[#5a8f52]/20 bg-[#5a8f52]/8 px-2.5 py-1 text-[11px] text-[#7bb06a]">
                        <CheckCircle2 className="h-3 w-3" />
                        {el}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Limites */}
                {analysis.limits && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2.5">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-400 mt-0.5" />
                    <p className="text-[11px] text-amber-300/80">{analysis.limits}</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => setStep(4)}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#c96544] py-3 text-[13px] font-semibold text-white transition-all hover:bg-[#d97757] shadow-[0_0_20px_rgba(217,119,87,0.35)]"
              >
                Choisir la destination
                <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}

          {/* ── Étape 4 : Destination ── */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-4"
            >
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <h3 className="text-[15px] font-semibold text-white mb-5">Où envoyer ce fichier ?</h3>
                <div className="grid grid-cols-2 gap-3">
                  {DESTINATIONS.map((dest) => {
                    const Icon = dest.icon;
                    const c = ACCENT_MAP[dest.accent] || ACCENT_MAP.violet;
                    return (
                      <button
                        key={dest.id}
                        onClick={() => handleDestinationSelect(dest)}
                        className={cn(
                          'flex items-center gap-3 rounded-xl border p-4 text-left transition-all hover:border-white/20',
                          c.border, c.bg,
                        )}
                      >
                        <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/10')}>
                          <Icon className={cn('h-4 w-4', c.text)} />
                        </div>
                        <span className="text-[12px] font-medium text-white/80">{dest.label}</span>
                        <ArrowRight className="ml-auto h-3.5 w-3.5 flex-shrink-0 text-white/20" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Étape 5 : Validation ── */}
          {step === 5 && destination && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center gap-6 py-8"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#5a8f52]/15 border border-[#5a8f52]/25">
                <CheckCircle2 className="h-8 w-8 text-[#7bb06a]" />
              </div>
              <div>
                <h3 className="text-[18px] font-bold text-white mb-2">Prêt à importer</h3>
                <p className="text-[13px] text-white/40">
                  Le fichier sera converti au format LIRI et ouvert dans <span className="text-white/70">{destination.label}</span>.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 px-5 py-2.5 text-[12px] text-white/50 transition-all hover:border-white/20 hover:text-white/80"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Recommencer
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex items-center gap-2 rounded-xl bg-[#c96544] px-6 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-[#d97757] shadow-[0_0_20px_rgba(217,119,87,0.35)]"
                >
                  <Sparkles className="h-4 w-4" />
                  Importer maintenant
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </StudioDesignerLikeShell>
  );
}
