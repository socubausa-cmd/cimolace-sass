/**
 * LibraryImportModal — flux d'import complet.
 * Pipeline : upload → analyser → preview → convertir → sauvegarder.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  Upload, Loader2, CheckCircle, AlertTriangle, X,
  FileImage, Layers, Palette, FileJson, Archive, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLibrary } from '../hooks/useLibrary';

const ACCEPT_TYPES = '.png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.cube,.json';

const STEP_LABELS = {
  idle: 'En attente',
  uploading: 'Chargement...',
  analyzing: 'Analyse en cours...',
  previewing: 'Génération aperçu...',
  converting: 'Conversion...',
  saving: 'Sauvegarde...',
  done: 'Importé !',
  error: 'Erreur',
};

const COMPAT_CONFIG = {
  100: { label: 'Parfait', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  70: { label: 'Partiel', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  30: { label: 'Conversion requise', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
};

export default function LibraryImportModal({ open, onClose }) {
  const { importJob, startImport, cancelImport } = useLibrary();
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customTags, setCustomTags] = useState('');

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setCustomTitle(file.name.replace(/\.[^.]+$/, ''));
    await startImport(file, {
      title: customTitle || file.name.replace(/\.[^.]+$/, ''),
      tags: customTags ? customTags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
    });
  }, [startImport, customTitle, customTags]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  if (!open) return null;

  const analysis = importJob?.analysis;
  const compat = analysis ? COMPAT_CONFIG[analysis.compatibility] : null;
  const isProcessing = importJob && !['idle', 'done', 'error'].includes(importJob.step);
  const isDone = importJob?.step === 'done';
  const isError = importJob?.step === 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-2xl border border-white/12 bg-[#0d1020] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
          <Upload className="h-5 w-5 text-[var(--school-accent)]" />
          <h2 className="text-[15px] font-bold text-white">Importer un asset</h2>
          <button onClick={onClose} className="ml-auto text-white/30 hover:text-white/70">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {/* Drop zone */}
          {!importJob && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed py-10 transition-colors',
                dragOver
                  ? 'border-[color-mix(in_srgb,var(--school-accent)_60%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_8%,transparent)]'
                  : 'border-white/15 hover:border-white/30 hover:bg-white/[0.02]',
              )}
            >
              <Upload className="h-10 w-10 text-white/20" />
              <div className="text-center">
                <p className="text-[13px] font-medium text-white/60">Glissez un fichier ici</p>
                <p className="text-[11px] text-white/30">ou cliquez pour choisir</p>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {['PNG', 'SVG', 'PDF', '.cube', 'JSON', 'JPG'].map((t) => (
                  <span key={t} className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/35">{t}</span>
                ))}
              </div>
              <input ref={fileInputRef} type="file" accept={ACCEPT_TYPES} className="hidden" onChange={handleInputChange} />
            </div>
          )}

          {/* Processing */}
          {importJob && (
            <div className="flex flex-col gap-4">
              {/* Progress */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-white/70">{STEP_LABELS[importJob.step] ?? ''}</span>
                  {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-[var(--school-accent)]" />}
                  {isDone && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                  {isError && <AlertTriangle className="h-4 w-4 text-red-400" />}
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn('h-full transition-all', isDone ? 'bg-emerald-500' : isError ? 'bg-red-500' : 'bg-[var(--school-accent)]')}
                    style={{ width: `${importJob.progress}%` }}
                  />
                </div>
              </div>

              {/* Preview */}
              {importJob.preview && (
                <div className="flex gap-4">
                  <div className="h-24 w-40 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/30">
                    <img src={importJob.preview} alt="preview" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex flex-col gap-2">
                    {analysis && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md border border-white/15 px-2 py-0.5 text-[11px] text-white/60">{analysis.detectedCategory}</span>
                          <span className="rounded-md border border-white/15 px-2 py-0.5 text-[11px] text-white/60">.{analysis.detectedFileType}</span>
                        </div>
                        {compat && (
                          <div className={cn('flex items-center gap-1.5 rounded-lg border px-2 py-1', compat.border, compat.bg)}>
                            <span className={cn('text-[11px] font-bold', compat.color)}>{analysis.compatibility}%</span>
                            <span className={cn('text-[11px]', compat.color)}>{compat.label}</span>
                          </div>
                        )}
                        {analysis.conversionNote && (
                          <p className="text-[10px] text-amber-400/70">{analysis.conversionNote}</p>
                        )}
                        <p className="text-[11px] text-white/40">{analysis.suggestedTags.slice(0, 4).join(' · ')}</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {isError && (
                <p className="text-[12px] text-red-400">{importJob.error}</p>
              )}
            </div>
          )}

          {/* Metadata form (shown after preview) */}
          {importJob?.preview && !isDone && !isError && (
            <div className="flex flex-col gap-2">
              <input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Titre de l'asset"
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/80 placeholder-white/25 outline-none focus:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]"
              />
              <input
                value={customTags}
                onChange={(e) => setCustomTags(e.target.value)}
                placeholder="Tags : education, science, visuel..."
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/80 placeholder-white/25 outline-none focus:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-white/8 px-5 py-3">
          {!isDone ? (
            <button onClick={cancelImport} className="rounded-lg border border-white/15 px-4 py-2 text-[12px] text-white/60 hover:border-white/25 hover:text-white">
              Annuler
            </button>
          ) : (
            <>
              <button onClick={() => { fileInputRef.current?.click(); }} className="rounded-lg border border-white/15 px-4 py-2 text-[12px] text-white/60 hover:border-white/25 hover:text-white">
                Importer un autre
              </button>
              <button onClick={onClose} className="flex items-center gap-1.5 rounded-lg bg-[var(--school-accent)] px-4 py-2 text-[12px] font-semibold text-black hover:bg-[#e5c448]">
                <CheckCircle className="h-3.5 w-3.5" />
                Terminé
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
