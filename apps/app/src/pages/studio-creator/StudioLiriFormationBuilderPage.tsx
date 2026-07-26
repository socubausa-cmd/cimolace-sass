/**
 * StudioLiriFormationBuilderPage — Formation Builder LIRI
 * Route: /studio/liri/formation
 * 3 colonnes : Arbre temporel | Éditeur | LIRI Assistant
 * V2 port from isna_app V1
 */
import React, { useCallback, useState } from 'react';
import { DEFAULT_TENANT_SLUG } from '@/config/platform';
import { Link } from 'react-router-dom';
import {
  GraduationCap, ArrowLeft, ChevronRight, ChevronDown, Plus, Sparkles,
  Clock, Target, BookOpen, Layers, Trash2, Save, Loader2,
  Calendar, Brain, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';

// ── Types ───────────────────────────────────────────────────────────────────

interface TreeNode {
  id: string;
  titre: string;
  objectif?: string;
  duree?: string;
  duree_estimee?: string;
  tag_pedagogique?: string;
  idee_centrale?: string;
  modules?: TreeNode[];
  periodes?: TreeNode[];
  cours?: TreeNode[];
  chapitres?: TreeNode[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const TYPE_PROGRAMMES = [
  { id: 'complet', label: 'Formation complète', duree: '6-12 mois' },
  { id: 'trimestre', label: 'Trimestre', duree: '3 mois' },
  { id: 'intensif', label: 'Stage intensif', duree: '1-4 semaines' },
  { id: 'annuel', label: 'Programme annuel', duree: '12 mois' },
  { id: 'workshop', label: 'Workshop', duree: '1-3 jours' },
  { id: 'coaching', label: 'Coaching', duree: 'Sur mesure' },
];

const NIVEAUX = ['débutant', 'intermédiaire', 'avancé', 'expert'];

// ── Tree Component ──────────────────────────────────────────────────────────

function TreeNodeComponent({ node, depth = 0, onSelect, selected }: {
  node: TreeNode;
  depth?: number;
  onSelect?: (n: TreeNode) => void;
  selected?: TreeNode | null;
}) {
  const [open, setOpen] = useState(depth < 2);
  const children = [
    ...(node.modules || []),
    ...(node.periodes || []),
    ...(node.cours || []),
    ...(node.chapitres || []),
  ];
  const isSelected = selected?.id === node.id;

  return (
    <div>
      <button onClick={() => { setOpen(v => !v); onSelect?.(node); }}
        // Sélection dans l'arbre : corail (était violet). C'est le seul repère
        // de « où je suis » → il garde toute son intensité.
        className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all hover:bg-[#f5f4ee]/[0.05]',
          isSelected && 'bg-[#d97757]/15 border border-[#d97757]/30')}
        style={{ paddingLeft: `${8 + depth * 14}px` }}>
        {children.length > 0 ? (
          open ? <ChevronDown className="h-3 w-3 flex-shrink-0 text-[#f5f4ee]/45" />
            : <ChevronRight className="h-3 w-3 flex-shrink-0 text-[#f5f4ee]/45" />
        ) : <span className="h-3 w-3 flex-shrink-0" />}
        <span className={cn('truncate text-[12px]', isSelected ? 'text-[#e8a97f] font-medium' : depth === 0 ? 'text-[#f5f4ee]/80 font-medium' : 'text-[#f5f4ee]/65')}>
          {node.titre || node.id}
        </span>
        {node.duree && <span className="ml-auto flex-shrink-0 text-[10px] text-[#f5f4ee]/60">{node.duree}</span>}
      </button>
      {open && children.map(child => (
        <TreeNodeComponent key={child.id} node={child} depth={depth + 1} onSelect={onSelect} selected={selected} />
      ))}
    </div>
  );
}

// ── Detail Panel ────────────────────────────────────────────────────────────

function DetailPanel({ node }: { node: TreeNode | null }) {
  if (!node) return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <Target className="h-8 w-8 text-[#f5f4ee]/20 mb-2" />
      <p className="text-[12px] text-[#f5f4ee]/65">Sélectionnez un élément dans l'arbre</p>
    </div>
  );

  return (
    // Les intitulés de champ étaient tous à /25 (2,3:1) : ce sont des étiquettes
    // à LIRE, pas de la décoration → remontées à /65 (6,7:1).
    <div className="flex flex-col gap-4 p-4">
      {node.titre && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.15em] text-[#f5f4ee]/65 mb-1">Titre</div>
          <div className="text-[15px] font-semibold text-[#f5f4ee]">{node.titre}</div>
        </div>
      )}
      {node.objectif && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.15em] text-[#f5f4ee]/65 mb-1 flex items-center gap-1.5">
            <Target className="h-3 w-3" /> Objectif
          </div>
          <p className="text-[12px] text-[#f5f4ee]/80 leading-relaxed">{node.objectif}</p>
        </div>
      )}
      {(node.duree || node.duree_estimee) && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.15em] text-[#f5f4ee]/65 mb-1 flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> Durée
          </div>
          <div className="text-[12px] text-[#f5f4ee]/80">{node.duree || node.duree_estimee}</div>
        </div>
      )}
      {node.tag_pedagogique && (
        <span className="inline-flex rounded-full bg-[#d97757]/15 border border-[#d97757]/30 px-2.5 py-1 text-[10px] text-[#e8a97f]">{node.tag_pedagogique}</span>
      )}
      {node.idee_centrale && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.15em] text-[#f5f4ee]/65 mb-1">Idée centrale</div>
          <p className="text-[12px] text-[#f5f4ee]/80 leading-relaxed">{node.idee_centrale}</p>
        </div>
      )}
    </div>
  );
}

// ── LIRI Assistant Panel ───────────────────────────────────────────────────

function LiriAssistant() {
  const [prompt, setPrompt] = useState('');
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b border-[#f5f4ee]/[0.09] px-4 py-3">
        <Sparkles className="h-3.5 w-3.5 text-[#e08a5f]" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f5f4ee]/65">Assistant LIRI</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="rounded-lg border border-[#f5f4ee]/[0.09] bg-[#1f1e1c] p-3 mb-3">
          <p className="text-[11px] text-[#f5f4ee]/65 leading-relaxed">
            L'assistant LIRI peut vous aider à structurer votre formation, générer des objectifs pédagogiques, et suggérer une progression.
          </p>
        </div>
      </div>
      <div className="border-t border-[#f5f4ee]/[0.09] p-3">
        <div className="flex gap-2">
          <input value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder="Décrivez votre besoin..."
            className="flex-1 rounded-lg border border-[#f5f4ee]/10 bg-[#2b2a27] px-3 py-2 text-[11px] text-[#f5f4ee] placeholder-[#f5f4ee]/45 outline-none focus:border-[#d97757]/45" />
          <button className="flex items-center gap-1 rounded-lg bg-[#d97757] px-3 py-2 text-[11px] font-medium text-[#1f1e1c] hover:bg-[#e08a5f] transition-colors">
            <Sparkles className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function StudioLiriFormationBuilderPage() {
  const [typeProgramme, setTypeProgramme] = useState('complet');
  const [niveau, setNiveau] = useState('intermediaire');
  const [titre, setTitre] = useState('');
  const [tree, setTree] = useState<TreeNode>({
    id: 'root', titre: 'Nouvelle Formation', modules: [
      { id: 'mod1', titre: 'Module 1 — Fondations', objectif: 'Poser les bases', duree: '4 semaines', cours: [] },
      { id: 'mod2', titre: 'Module 2 — Approfondissement', objectif: 'Consolider', duree: '4 semaines', cours: [] },
    ],
  });
  const [selected, setSelected] = useState<TreeNode | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addModule = useCallback(() => {
    const mods = [...(tree.modules || [])];
    mods.push({ id: `mod-${Date.now()}`, titre: `Module ${mods.length + 1}`, duree: '4 semaines', cours: [] });
    setTree({ ...tree, modules: mods });
  }, [tree]);

  const addCourse = useCallback(() => {
    if (!selected) return;
    const mods = tree.modules?.map(m => {
      if (m.id === selected.id || m.cours?.some(c => c.id === selected.id)) {
        const parent = m.id === selected.id ? m : m;
        const cours = [...(parent.cours || []), { id: `cours-${Date.now()}`, titre: `Cours ${(parent.cours?.length || 0) + 1}`, duree: '2h', chapitres: [] }];
        return { ...m, cours: m.id === selected.id ? cours : m.cours?.map(c => c.id === selected.id ? { ...c } : c) };
      }
      return m;
    }) || [];
    setTree({ ...tree, modules: mods });
  }, [selected, tree]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/studio/formations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'X-Tenant-Slug': localStorage.getItem('tenantSlug') || DEFAULT_TENANT_SLUG,
        },
        body: JSON.stringify({ title: titre || tree.titre, programmeType: typeProgramme, audienceLevel: niveau }),
      });
      const json = await res.json();
      if (json.data) {
        // Save the tree
        await fetch(`${import.meta.env.VITE_API_URL}/studio/formations/${json.data.id}/tree`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'X-Tenant-Slug': localStorage.getItem('tenantSlug') || DEFAULT_TENANT_SLUG,
          },
          body: JSON.stringify(tree),
        });
      } else setError(json.error?.message || 'Erreur sauvegarde');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }, [titre, tree, typeProgramme, niveau]);

  return (
    <div className="flex flex-col min-h-screen bg-[#262624] text-[#f5f4ee]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#f5f4ee]/[0.09]">
        <div className="flex items-center gap-4">
          <Link to="/studio/liri" className="text-[#f5f4ee]/65 hover:text-[#d97757] transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[#f5f4ee]">Formation Builder</h1>
            <p className="text-[11px] text-[#f5f4ee]/65">Programme pédagogique structuré</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Les <select> ont besoin d'un fond OPAQUE : la liste déroulante est
              rendue par l'OS et un bg translucide laissait passer le fond bleu. */}
          <select value={typeProgramme} onChange={e => setTypeProgramme(e.target.value)}
            className="rounded-lg border border-[#f5f4ee]/10 bg-[#2b2a27] px-3 py-1.5 text-[11px] text-[#f5f4ee]/80 outline-none">
            {TYPE_PROGRAMMES.map(t => <option key={t.id} value={t.id}>{t.label} ({t.duree})</option>)}
          </select>
          <select value={niveau} onChange={e => setNiveau(e.target.value)}
            className="rounded-lg border border-[#f5f4ee]/10 bg-[#2b2a27] px-3 py-1.5 text-[11px] text-[#f5f4ee]/80 outline-none">
            {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-[#d97757] px-3 py-1.5 text-[11px] font-semibold text-[#1f1e1c] hover:bg-[#e08a5f] disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Sauver
          </button>
        </div>
      </header>

      {/* 3-col layout */}
      <div className="flex min-h-0 flex-1">
        {/* Col 1 — Tree */}
        <aside className="flex w-56 flex-shrink-0 flex-col border-r border-[#f5f4ee]/[0.09] bg-[#30302e]">
          <div className="flex items-center justify-between border-b border-[#f5f4ee]/[0.09] px-4 py-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-[#e0a458]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f5f4ee]/65">Structure</span>
            </div>
            <div className="flex gap-1">
              <button onClick={addModule} title="Ajouter un module"
                className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-[#d97757]/20 transition-colors">
                <Plus className="h-3.5 w-3.5 text-[#e08a5f]" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <input value={titre} onChange={e => { setTitre(e.target.value); setTree({ ...tree, titre: e.target.value || tree.titre }); }}
              placeholder="Titre de la formation..."
              className="w-full mb-2 rounded-lg border border-[#f5f4ee]/10 bg-[#2b2a27] px-3 py-1.5 text-[12px] text-[#f5f4ee] placeholder-[#f5f4ee]/45 outline-none focus:border-[#d97757]/45" />
            <TreeNodeComponent node={tree} onSelect={setSelected} selected={selected} />
          </div>
        </aside>

        {/* Col 2 — Editor */}
        <main className="flex-1 overflow-y-auto border-r border-[#f5f4ee]/[0.09]">
          <div className="flex items-center justify-between border-b border-[#f5f4ee]/[0.09] px-4 py-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 text-[#e0a458]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f5f4ee]/65">Éditeur</span>
            </div>
            {selected && (
              // « Cours » est une action locale à la colonne : ambre plein pour
              // la distinguer du corail de « Sauver » (action globale de la
              // page) sans revenir à un bleu. Encre sombre → 6,9:1.
              <button onClick={addCourse} title="Ajouter un cours"
                className="flex items-center gap-1 rounded-lg bg-[#d99a4e] px-2.5 py-1 text-[11px] font-medium text-[#1f1e1c] hover:bg-[#e0a458] transition-colors">
                <Plus className="h-3 w-3" /> Cours
              </button>
            )}
          </div>
          <DetailPanel node={selected} />
        </main>

        {/* Col 3 — Assistant LIRI */}
        <aside className="flex w-64 flex-shrink-0 flex-col bg-[#30302e]">
          <LiriAssistant />
        </aside>
      </div>
    </div>
  );
}
