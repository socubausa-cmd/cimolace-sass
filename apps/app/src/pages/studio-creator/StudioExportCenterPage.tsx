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

/**
 * Les cinq formats d'export. La couleur est le SEUL repère qui les distingue
 * dans la liste (même gabarit de carte, même icône ronde), donc chaque entrée
 * garde une teinte propre — mais prise dans la rampe chaude LIRI.
 *
 * Pourquoi corriger ici et pas laisser studioWarm.css faire : ce remap écrase
 * TOUTES les classes froides vers un unique corail. Il aurait rendu ces cinq
 * cartes rigoureusement identiques — la différenciation aurait disparu au lieu
 * d'être traduite.
 *
 * `orange` (PowerPoint) est conservé tel quel : c'est la teinte de la marque
 * tierce, et elle est déjà chaude. `amber` l'était aussi.
 */
const FORMATS = [
  // or #d99a4e — la sauvegarde du projet, le format « maître »
  { id: 'json', label: 'JSON Projet', desc: 'Sauvegarde complète — diapositives, sections', icon: FileJson, color: 'text-[#e6b878]', bg: 'bg-[#d99a4e]/10', border: 'border-[#d99a4e]/20' },
  // argile #cf8059
  { id: 'pdf', label: 'PDF Présentation', desc: 'Une diapositive par page — prêt à projeter', icon: FileText, color: 'text-[#e0976a]', bg: 'bg-[#cf8059]/10', border: 'border-[#cf8059]/20' },
  // orange : couleur de la marque Microsoft PowerPoint — laissée intacte
  { id: 'pptx', label: 'PowerPoint', desc: 'Export .pptx compatible Office', icon: Presentation, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  // corail #d97757 — le support destiné aux élèves, l'export le plus demandé
  { id: 'student-pdf', label: 'Support Élève', desc: 'PDF avec éléments visibles par les élèves', icon: GraduationCap, color: 'text-[#e08a5f]', bg: 'bg-[#d97757]/10', border: 'border-[#d97757]/20' },
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
        alert(`Tâche d'export créée : ${json.data.id}`);
      } else setError(json.error?.message || 'Erreur');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setExporting(null);
    }
  };

  return (
    // #0a0a14 (navy quasi noir, banni) → #262624, le fond de page de la charte
    <div className="flex flex-col min-h-screen bg-[#262624] text-[#f5f4ee]">
      <header className="flex items-center gap-4 px-6 py-4 border-b border-white/[0.09]">
        <Link to="/studio/liri" className="text-white/58 hover:text-white/85">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-[#f5f4ee]">Centre d'export</h1>
          <p className="text-[11px] text-white/62">Export multi-formats</p>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <label className="text-[12px] text-white/65 mb-2 block">Identifiant d'espace de travail (optionnel)</label>
          {/* Champ de saisie : fond #2b2a27 de la charte (l'ancien bg-white/[0.04] laissait
              voir le navy). Le focus passe au corail — c'est la couleur des actions. */}
          <input value={workspaceId} onChange={e => setWorkspaceId(e.target.value)}
            placeholder="Laissez vide pour un nouvel export..."
            className="w-full rounded-xl border border-white/10 bg-[#2b2a27] px-4 py-2.5 text-[13px] text-[#f5f4ee]/85 placeholder:text-white/45 outline-none focus:border-[#d97757]/45" />
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
                  <div className="text-[13px] font-medium text-[#f5f4ee]">{f.label}</div>
                  {/* white/30 (2,7:1) → white/62 : c'est une phrase, pas un ornement */}
                  <div className="text-[11px] text-white/62">{f.desc}</div>
                </div>
                {exporting === f.id ? (
                  <Loader2 className="h-5 w-5 animate-spin text-[#e08a5f]" />
                ) : (
                  <Download className="h-5 w-5 text-white/45" />
                )}
              </button>
            );
          })}
        </div>
        {/* Alerte : #ef6a52 de la charte ne fait que 4,28:1 sur #262624 — pour du
            texte courant on éclaircit vers #f28a74 (6,25:1). */}
        {error && <p className="text-[12px] text-[#f28a74] mt-4">{error}</p>}
      </div>
    </div>
  );
}
