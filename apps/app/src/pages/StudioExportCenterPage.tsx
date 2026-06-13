/**
 * StudioExportCenterPage — Export PDF / JSON / PPTX
 * Route: /studio/export-center
 */
import React, { useState } from 'react';
import { DEFAULT_TENANT_SLUG } from '@/config/platform';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Download, FileJson, FileText, Presentation,
  GraduationCap, BookOpen, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';

const FORMATS = [
  { id: 'json', label: 'JSON Projet', desc: 'Sauvegarde complète — slides, sections', icon: FileJson, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { id: 'pdf', label: 'PDF Présentation', desc: 'Un slide par page — prêt à projeter', icon: FileText, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { id: 'pptx', label: 'PowerPoint', desc: 'Export .pptx compatible Office', icon: Presentation, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  { id: 'student-pdf', label: 'Support Élève', desc: 'PDF avec éléments visibles par les élèves', icon: GraduationCap, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  { id: 'teacher-pdf', label: 'Guide Professeur', desc: 'PDF complet avec notes et scripts', icon: BookOpen, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
];

export default function StudioExportCenterPage() {
  const [exporting, setExporting] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState('');
  const [error, setError] = useState('');

  const handleExport = async (formatId: string) => {
    setExporting(formatId);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/studio/render-jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'X-Tenant-Slug': localStorage.getItem('tenantSlug') || DEFAULT_TENANT_SLUG,
        },
        body: JSON.stringify({ workspaceId: workspaceId || undefined, jobType: 'export', exportFormat: formatId }),
      });
      const json = await res.json();
      if (json.data) {
        alert(`Job d'export créé : ${json.data.id}`);
      } else setError(json.error?.message || 'Erreur');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a14] text-white">
      <header className="flex items-center gap-4 px-6 py-4 border-b border-white/[0.06]">
        <Link to="/studio/liri" className="text-white/40 hover:text-white/70">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-white">Export Center</h1>
          <p className="text-[11px] text-white/30">Export multi-formats</p>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <label className="text-[12px] text-white/40 mb-2 block">Workspace ID (optionnel)</label>
          <input value={workspaceId} onChange={e => setWorkspaceId(e.target.value)}
            placeholder="Laissez vide pour un nouvel export..."
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[13px] text-white/80 placeholder-white/22 outline-none focus:border-violet-500/30" />
        </div>
        <div className="grid gap-3">
          {FORMATS.map(f => {
            const Icon = f.icon;
            return (
              <button key={f.id} onClick={() => handleExport(f.id)} disabled={exporting !== null}
                className={cn('flex items-center gap-4 rounded-xl border p-4 text-left transition-all hover:bg-white/[0.04]', f.border, f.bg, 'bg-opacity-30')}>
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', f.bg)}>
                  <Icon className={cn('h-5 w-5', f.color)} />
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-white">{f.label}</div>
                  <div className="text-[11px] text-white/30">{f.desc}</div>
                </div>
                {exporting === f.id ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white/40" />
                ) : (
                  <Download className="h-5 w-5 text-white/20" />
                )}
              </button>
            );
          })}
        </div>
        {error && <p className="text-[12px] text-red-400 mt-4">{error}</p>}
      </div>
    </div>
  );
}
