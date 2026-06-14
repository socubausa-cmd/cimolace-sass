/**
 * StudioExportCenterPage — export PDF / JSON / PPTX / support élève / prof.
 * Route : /studio/export-center
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft, Download, FileJson, FileText, Presentation, GraduationCap, BookOpen,
  CheckCircle, Loader2, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSmartboardStore } from '@/stores/smartboard.store';
import {
  exportProjectJson, exportSlidesPdf, exportSlidesPptx,
  exportStudentPdf, exportTeacherPdf,
} from '@/features/export/services/exportService';

const EXPORT_FORMATS = [
  {
    id: 'json',
    label: 'JSON Projet',
    description: 'Sauvegarde complète — slides, sections, états progressifs',
    icon: FileJson,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  {
    id: 'pdf',
    label: 'PDF Présentation',
    description: 'Un slide par page — prêt à projeter',
    icon: FileText,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    id: 'pptx',
    label: 'PowerPoint',
    description: 'Export .pptx compatible Office et Google Slides',
    icon: Presentation,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
  },
  {
    id: 'student-pdf',
    label: 'Support Élève',
    description: 'PDF avec uniquement les éléments visibles par les élèves',
    icon: GraduationCap,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
  {
    id: 'teacher-pdf',
    label: 'Guide Professeur',
    description: 'PDF complet avec notes prof, scripts et sections',
    icon: BookOpen,
    color: 'text-[var(--school-accent)]',
    bg: 'bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]',
    border: 'border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]',
  },
];

function ExportCard({ format, slides, projectTitle }) {
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [error, setError] = useState('');

  const handleExport = async () => {
    if (!slides.length) { setError('Aucun slide à exporter'); return; }
    setStatus('loading');
    setError('');
    try {
      switch (format.id) {
        case 'json': exportProjectJson(slides); break;
        case 'pdf': await exportSlidesPdf(slides, null, { title: projectTitle }); break;
        case 'pptx': await exportSlidesPptx(slides, projectTitle); break;
        case 'student-pdf': await exportStudentPdf(slides, `${projectTitle} — Élève`); break;
        case 'teacher-pdf': await exportTeacherPdf(slides, `${projectTitle} — Prof`); break;
      }
      setStatus('done');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (e) {
      setError(e.message ?? 'Erreur inconnue');
      setStatus('error');
    }
  };

  const Icon = format.icon;

  return (
    <div className={cn('flex flex-col gap-3 rounded-xl border p-4', format.border, format.bg)}>
      <div className="flex items-start gap-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', format.border, format.bg)}>
          <Icon className={cn('h-5 w-5', format.color)} />
        </div>
        <div className="flex-1">
          <h3 className="text-[13px] font-semibold text-white">{format.label}</h3>
          <p className="text-[11px] text-white/45">{format.description}</p>
        </div>
      </div>

      {status === 'error' && (
        <p className="flex items-center gap-1.5 text-[11px] text-red-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}

      <button
        onClick={handleExport}
        disabled={status === 'loading' || !slides.length}
        className={cn(
          'flex items-center justify-center gap-2 rounded-lg py-2 text-[12px] font-semibold transition-colors disabled:opacity-40',
          format.id === 'teacher-pdf'
            ? 'bg-[var(--school-accent)] text-black hover:bg-[#e5c448]'
            : 'border border-white/15 text-white hover:bg-white/5',
        )}
      >
        {status === 'loading' ? (
          <><Loader2 className="h-4 w-4 animate-spin" />Export en cours...</>
        ) : status === 'done' ? (
          <><CheckCircle className="h-4 w-4 text-emerald-400" />Téléchargé</>
        ) : (
          <><Download className="h-4 w-4" />Exporter</>
        )}
      </button>
    </div>
  );
}

export default function StudioExportCenterPage() {
  const slides = useSmartboardStore((s) => s.slides);
  const [projectTitle, setProjectTitle] = useState('LIRI SmartBoard');

  const totalElements = slides.reduce(
    (acc, s) => acc + (s.initialState?.elements?.length ?? 0), 0,
  );

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#05070c] text-white">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/8 bg-[#080a12] px-4 py-2.5">
        <Link to="/studio" className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/60 hover:text-[var(--school-accent)]">
          <ChevronLeft className="h-3.5 w-3.5" />Studio
        </Link>
        <div className="h-5 w-px bg-white/10" />
        <Download className="h-4 w-4 text-[var(--school-accent)]" />
        <h1 className="text-[14px] font-bold text-white">Export Center</h1>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
        {/* Project info */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-white/40 uppercase tracking-wider">Nom du projet</label>
              <input
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white outline-none focus:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)]"
              />
            </div>
            <div className="flex gap-6 text-center">
              <div>
                <div className="text-[20px] font-bold text-[var(--school-accent)]">{slides.length}</div>
                <div className="text-[10px] text-white/40">Slides</div>
              </div>
              <div>
                <div className="text-[20px] font-bold text-white">{totalElements}</div>
                <div className="text-[10px] text-white/40">Éléments</div>
              </div>
              <div>
                <div className="text-[20px] font-bold text-white">
                  {slides.reduce((a, s) => a + (s.sections?.length ?? 0), 0)}
                </div>
                <div className="text-[10px] text-white/40">Sections</div>
              </div>
            </div>
          </div>
        </div>

        {slides.length === 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="flex items-center gap-2 text-[12px] text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Aucun slide. Créez un cours via le Course Builder et envoyez-le au Designer.
            </p>
          </div>
        )}

        {/* Format grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXPORT_FORMATS.map((format) => (
            <ExportCard key={format.id} format={format} slides={slides} projectTitle={projectTitle} />
          ))}
        </div>
      </div>
    </div>
  );
}
