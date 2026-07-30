/**
 * StudioLiriFormationBuilderPage — Formation Builder LIRI
 * Route : /studio/liri/formation
 * 3 colonnes : Arbre temporel | Éditeur | LIRI Assistant
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap, Brain, ChevronRight, ChevronDown, Loader2, Sparkles,
  ArrowRight, AlertCircle, CheckCircle2, BookOpen, Calendar, Clock,
  Target, Layers, RefreshCw, Save, Trash2, Cloud, Clapperboard,
} from 'lucide-react';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { usePublishToClassroom } from '@/hooks/usePublishToClassroom';
import { cn } from '@/lib/utils';
import StudioDesignerLikeShell from '@/components/liri/liri-ecosystem/StudioDesignerLikeShell';
import {
  callLiriFormationEngineAuthenticated,
  PROGRAMME_OPTIONS,
} from '@/lib/callLiriFormationEngine';
import { supabase } from '@/lib/customSupabaseClient';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
  listFormationDrafts,
  getFormationDraft,
  insertFormationDraft,
  updateFormationDraft,
  deleteFormationDraft,
} from '@/lib/liriFormationDraftsApi';

const NIVEAUX = ['débutant', 'intermédiaire', 'avancé', 'expert'];

/**
 * Moteur IA (= profil pédagogique côté edge) : chaque choix fixe le fournisseur
 * PRÉFÉRÉ ; si indisponible (crédits, panne), l'edge bascule automatiquement sur
 * le suivant de la chaîne et le signale dans meta.message.
 */
const PROFIL_OPTIONS = [
  { value: 'auto', label: 'Auto — meilleur moteur disponible (recommandé)' },
  { value: 'maitre_pedagogue', label: 'Maître Pédagogue — Claude (Anthropic)' },
  { value: 'architecte', label: 'Architecte — GPT (OpenAI)' },
  { value: 'cours_rapide', label: 'Cours Rapide — Grok (xAI)' },
  { value: 'assistant_eco', label: 'Assistant Éco — DeepSeek' },
];

/** Transforme le JSON `cours` LIRI (10 étapes) en racine d'arbre pour la colonne Structure. */
function formationTreeFromLiriCours(cours, typeProgrammeLabel) {
  const etapes = Array.isArray(cours?.etapes) ? cours.etapes : [];
  return {
    id: 'formation-root',
    titre: cours?.titre || 'Formation',
    objectif: cours?.objectif,
    duree: typeProgrammeLabel,
    cours: etapes.map((e, i) => ({
      id: `etape-${i + 1}`,
      titre: e?.smartboard?.titre || e?.titre || `Étape ${i + 1}`,
      objectif: e?.masterscript?.intention || e?.objectif,
      duree_estimee: e?.duree_estimee,
      tag_pedagogique: e?.tag_pedagogique,
      idee_centrale: e?.idee_centrale,
    })),
  };
}

/**
 * Squelette généré → draft du POSTE PRODUCTION (usePublishToClassroom :
 * modules → formation_weeks → formation_days). 1 étape = 1 jour de production
 * (storyboard / image par image / vidéo / support / quiz se font là-bas) ;
 * le support de chaque jour est semé avec l'idée centrale + l'objectif.
 */
function formationTreeToProductionDraft(formation, meta) {
  const etapes = Array.isArray(formation?.cours) ? formation.cours : [];
  const days = etapes.map((e, i) => {
    const titre = e?.titre || `Étape ${i + 1}`;
    const slides = [
      e?.idee_centrale ? { title: 'Idée centrale', content: `<p>${e.idee_centrale}</p>` } : null,
      e?.objectif ? { title: 'Objectif', content: `<p>${e.objectif}</p>` } : null,
    ].filter(Boolean);
    if (!slides.length) slides.push({ title: titre, content: `<p>${titre}</p>` });
    return { title: titre, powerpoint: { type: 'slides', title: titre, slides } };
  });
  const weeks = [];
  for (let i = 0; i < days.length; i += 4) {
    weeks.push({ title: `Semaine ${weeks.length + 1}`, days: days.slice(i, i + 4) });
  }
  return {
    title: formation?.titre || 'Formation',
    description: formation?.objectif || '',
    category: meta?.type_programme_label || undefined,
    status: 'draft', // pas visible élève avant validation du rendu au poste production
    modules: [{ title: 'Programme', weeks: weeks.length ? weeks : [{ title: 'Semaine 1', days: [] }] }],
  };
}

// ─── Tree ────────────────────────────────────────────────────────────────────
function TreeNode({ node, depth = 0, onSelect, selected }) {
  const [open, setOpen] = useState(depth < 2);
  const children = [...(node.modules || []), ...(node.periodes || []), ...(node.cours || []), ...(node.chapitres || [])];
  const isSelected = selected?.id === node.id;
  return (
    <div>
      <button
        onClick={() => { setOpen(v => !v); onSelect?.(node); }}
        className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all hover:bg-white/5', isSelected && 'bg-[#d97757]/15 border border-[#d97757]/25')}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {children.length > 0
          ? (open ? <ChevronDown className="h-3 w-3 flex-shrink-0 text-white/30" /> : <ChevronRight className="h-3 w-3 flex-shrink-0 text-white/30" />)
          : <span className="h-3 w-3 flex-shrink-0" />
        }
        <span className={cn('truncate text-[12px]', isSelected ? 'text-[#e8a97f] font-medium' : depth === 0 ? 'text-white/80 font-medium' : 'text-white/50')}>
          {node.titre || node.label || node.id}
        </span>
        {node.duree && <span className="ml-auto flex-shrink-0 text-[10px] text-white/20">{node.duree}</span>}
      </button>
      {open && children.map(child => (
        <TreeNode key={child.id} node={child} depth={depth + 1} onSelect={onSelect} selected={selected} />
      ))}
    </div>
  );
}

// ─── Detail ──────────────────────────────────────────────────────────────────
function DetailPanel({ node }) {
  if (!node) return null;
  return (
    <div className="flex flex-col gap-4">
      {node.titre && <div><div className="text-[11px] uppercase tracking-[0.15em] text-white/30 mb-1">Titre</div><div className="text-[15px] font-semibold text-white">{node.titre}</div></div>}
      {node.objectif && <div><div className="text-[11px] uppercase tracking-[0.15em] text-white/30 mb-1 flex items-center gap-1.5"><Target className="h-3 w-3" /> Objectif</div><p className="text-[13px] text-white/60 leading-relaxed">{node.objectif}</p></div>}
      {(node.duree || node.duree_estimee) && <div><div className="text-[11px] uppercase tracking-[0.15em] text-white/30 mb-1 flex items-center gap-1.5"><Clock className="h-3 w-3" /> Durée</div><div className="text-[13px] text-white/60">{node.duree || node.duree_estimee}</div></div>}
      {node.tag_pedagogique && <span className="inline-flex rounded-full bg-[#d97757]/15 border border-[#d97757]/25 px-2.5 py-1 text-[11px] text-[#e8a97f]">{node.tag_pedagogique}</span>}
      {node.idee_centrale && <div><div className="text-[11px] uppercase tracking-[0.15em] text-white/30 mb-1">Idée centrale</div><p className="text-[13px] text-white/60 leading-relaxed">{node.idee_centrale}</p></div>}
      {node.cours?.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-[0.15em] text-white/30 mb-2">{node.cours.length} cours</div>
          <div className="flex flex-col gap-1.5">
            {node.cours.map(c => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <BookOpen className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
                <div className="min-w-0">
                  <div className="text-[12px] text-white/75 font-medium truncate">{c.titre}</div>
                  {c.objectif && <div className="text-[10px] text-white/30 truncate">{c.objectif}</div>}
                </div>
                {c.duree_estimee && <span className="ml-auto flex-shrink-0 text-[10px] text-white/20">{c.duree_estimee}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Form ────────────────────────────────────────────────────────────────────
function CreationForm({ onResult, loading, setLoading, error, setError }) {
  const [form, setForm] = useState({ sujet: '', type_programme: 'one_month_program', niveau: 'intermédiaire', contexte: 'Prorascience', profil: 'auto' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inputCls = 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13px] text-white placeholder-white/30 outline-none transition-all focus:border-[#d97757]/50 focus:bg-white/[0.07]';
  const labelCls = 'block text-[11px] font-medium uppercase tracking-[0.12em] text-white/40 mb-1.5';

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.sujet.trim()) return;
    setLoading(true); setError(null);
    try {
      if (!isSupabaseConfigured) {
        throw new Error('Configuration Supabase manquante (variables d\'environnement sur le build).');
      }
      const payload = await callLiriFormationEngineAuthenticated(supabase, {
        sujet: form.sujet.trim(),
        niveau: form.niveau,
        contexte: form.contexte,
        profil_pedagogique: form.profil,
      });
      const cours = payload?.cours;
      if (!cours || typeof cours !== 'object') throw new Error('Réponse serveur invalide.');
      if (!Array.isArray(cours.etapes) || cours.etapes.length < 1) {
        throw new Error('Structure du cours incorrecte (étapes manquantes).');
      }
      const progLabel = PROGRAMME_OPTIONS.find(o => o.value === form.type_programme)?.label
        || form.type_programme;
      onResult({
        formation: formationTreeFromLiriCours(cours, progLabel),
        meta: {
          ...(payload.meta && typeof payload.meta === 'object' ? payload.meta : {}),
          type_programme: form.type_programme,
          type_programme_label: progLabel,
        },
      });
    } catch (err) {
      const msg = err?.message || '';
      if (err?.name === 'AbortError' || msg.includes('aborted')) {
        setError('Délai dépassé — réessayez ou raccourcissez le sujet.');
      } else {
        setError(msg || 'Erreur lors de la génération.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className={labelCls}>Sujet de la formation</label>
        <textarea value={form.sujet} onChange={e => set('sujet', e.target.value)} placeholder="Ex : Mathématiques niveau terminale, bases de la comptabilité..." rows={3} className={cn(inputCls, 'resize-none')} required />
      </div>
      <div>
        <label className={labelCls}>Type de programme</label>
        <select value={form.type_programme} onChange={e => set('type_programme', e.target.value)} className={cn(inputCls, 'cursor-pointer')}>
          {PROGRAMME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Niveau</label>
          <select value={form.niveau} onChange={e => set('niveau', e.target.value)} className={cn(inputCls, 'cursor-pointer')}>
            {NIVEAUX.map(n => <option key={n} value={n}>{n.charAt(0).toUpperCase() + n.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Contexte</label>
          <select value={form.contexte} onChange={e => set('contexte', e.target.value)} className={cn(inputCls, 'cursor-pointer')}>
            {['Prorascience','Général','Sciences','Humanités','Technologie','Arts'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Moteur IA</label>
        <select value={form.profil} onChange={e => set('profil', e.target.value)} className={cn(inputCls, 'cursor-pointer')}>
          {PROFIL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="mt-1.5 text-[11px] text-white/30">Si le moteur choisi est indisponible (crédits, panne), LIRI bascule automatiquement sur le suivant.</p>
      </div>
      {error && <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-[12px] text-red-300"><AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />{error}</div>}
      <button type="submit" disabled={loading || !form.sujet.trim()}
        className={cn('flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold transition-all',
          loading || !form.sujet.trim()
            ? 'cursor-not-allowed border border-white/10 bg-white/5 text-white/30'
            : 'bg-[#c96544] text-white hover:bg-[#d97757] shadow-[0_0_20px_rgba(217,119,87,0.38)]')}>
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Génération...</> : <><Sparkles className="h-4 w-4" />Générer la formation</>}
      </button>
    </form>
  );
}

// ─── Assistant card ──────────────────────────────────────────────────────────
function ACard({ icon: Icon, title, accent, text }) {
  const m = { violet: 'text-[#e08a5f] bg-[#d97757]/10 border-[#d97757]/20', blue: 'text-[#e0a458] bg-[#d4924a]/10 border-[#d4924a]/20', amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20', emerald: 'text-[#7bb06a] bg-[#5a8f52]/10 border-[#5a8f52]/20', cyan: 'text-[#e0a458] bg-[#d4924a]/10 border-[#d4924a]/20' };
  const cls = (m[accent] || m.violet).split(' ');
  return (
    <div className={cn('rounded-xl border p-3', cls[1], cls[2])}>
      <div className="flex items-center gap-2 mb-1.5"><Icon className={cn('h-3.5 w-3.5 flex-shrink-0', cls[0])} /><span className={cn('text-[11px] font-semibold', cls[0])}>{title}</span></div>
      <p className="text-[11px] text-white/40 leading-relaxed">{text}</p>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function StudioLiriFormationBuilderPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [result, setResult] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [draftCloudId, setDraftCloudId] = useState(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftMsg, setDraftMsg] = useState(null);
  const { publish } = usePublishToClassroom();
  const [producing, setProducing] = useState(false);
  const [prodMsg, setProdMsg] = useState(null);

  // Squelette → vraie formation (tables relationnelles) → ouverture au poste production.
  const sendToProduction = useCallback(async () => {
    if (!result?.formation || producing) return;
    setProducing(true);
    setProdMsg(null);
    const res = await publish(formationTreeToProductionDraft(result.formation, result.meta));
    setProducing(false);
    if (res?.error || !res?.id) {
      setProdMsg(res?.error?.message || 'Envoi au poste production impossible.');
      return;
    }
    navigate(`/studio/formation?editFormationId=${res.id}`);
  }, [result, producing, publish, navigate]);

  const refreshDrafts = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) {
      setDrafts([]);
      return;
    }
    const { data } = await listFormationDrafts(supabase, userId);
    setDrafts(data || []);
  }, [userId]);

  useEffect(() => {
    refreshDrafts();
  }, [refreshDrafts]);

  const handleResult = useCallback((data) => {
    setResult(data);
    setSelectedNode(data.formation);
    setDraftCloudId(null);
  }, []);

  const loadCloudDraft = useCallback(async (id) => {
    if (!isSupabaseConfigured) return;
    setDraftBusy(true);
    setDraftMsg(null);
    const { data, error: err } = await getFormationDraft(supabase, id);
    setDraftBusy(false);
    if (err || !data?.payload || typeof data.payload !== 'object') {
      setDraftMsg(err?.message || 'Brouillon illisible');
      return;
    }
    const p = data.payload;
    if (!p.formation || typeof p.formation !== 'object') {
      setDraftMsg('Payload incomplet');
      return;
    }
    setResult({ formation: p.formation, meta: p.meta && typeof p.meta === 'object' ? p.meta : {} });
    setSelectedNode(p.formation);
    setDraftCloudId(id);
  }, []);

  const saveCloudDraft = useCallback(async () => {
    if (!userId || !result?.formation || !isSupabaseConfigured) return;
    setDraftBusy(true);
    setDraftMsg(null);
    const title = String(result.formation.titre || 'Formation').slice(0, 200);
    const payload = { formation: result.formation, meta: result.meta || {} };
    try {
      if (draftCloudId) {
        const { error: err } = await updateFormationDraft(supabase, { id: draftCloudId, title, payload });
        if (err) throw err;
        setDraftMsg('Enregistré');
      } else {
        const { data, error: err } = await insertFormationDraft(supabase, { ownerId: userId, title, payload });
        if (err) throw err;
        if (data?.id) setDraftCloudId(data.id);
        setDraftMsg('Sauvegardé dans le cloud');
      }
      await refreshDrafts();
    } catch (e) {
      setDraftMsg(e?.message || 'Échec sauvegarde');
    } finally {
      setDraftBusy(false);
    }
  }, [userId, result, draftCloudId, refreshDrafts]);

  const removeCloudDraft = useCallback(async (id, e) => {
    e?.stopPropagation?.();
    if (!window.confirm('Supprimer ce brouillon ?')) return;
    setDraftBusy(true);
    const { error: err } = await deleteFormationDraft(supabase, id);
    setDraftBusy(false);
    if (err) {
      setDraftMsg(err.message || 'Suppression impossible');
      return;
    }
    if (draftCloudId === id) {
      setResult(null);
      setSelectedNode(null);
      setDraftCloudId(null);
    }
    await refreshDrafts();
  }, [draftCloudId, refreshDrafts]);

  const formation = result?.formation;

  const clearFormation = useCallback(() => {
    setResult(null);
    setSelectedNode(null);
    setDraftCloudId(null);
  }, []);

  return (
    <StudioDesignerLikeShell
      railActiveKey="formation"
      pageLabel="Création"
      pageAccent="blue"
      TitleIcon={GraduationCap}
      titleLine="Création de formation"
      topBarActions={formation ? (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate('/studio/liri/cours')} className="flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-400 transition-all hover:bg-amber-500/20">
            <Brain className="h-3.5 w-3.5" /> Course Builder
          </button>
          <button type="button" onClick={() => navigate('/studio/smartboard-designer')} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/70 transition-all hover:border-white/25 hover:text-white">
            <Layers className="h-3.5 w-3.5" /> Designer
          </button>
          <button type="button" onClick={sendToProduction} disabled={producing} className="flex items-center gap-1.5 rounded-lg bg-[#c96544] px-3 py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-[#d97757] shadow-[0_0_12px_rgba(217,119,87,0.35)] disabled:opacity-60">
            {producing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clapperboard className="h-3.5 w-3.5" />}
            {producing ? 'Envoi…' : 'Poste production'}
          </button>
        </div>
      ) : null}
    >
      <div className="flex min-h-0 w-full flex-1">
        {/* Gauche */}
        <aside className="flex w-56 flex-shrink-0 flex-col border-r border-white/[0.07] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
            <Calendar className="h-3.5 w-3.5 text-[#e0a458]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">Structure</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 min-h-0">
            {!formation
              ? <div className="flex flex-col items-center justify-center py-8 text-center"><GraduationCap className="h-8 w-8 text-white/10 mb-3" /><p className="text-[11px] text-white/20">Générez une formation<br />ou chargez un brouillon</p></div>
              : <TreeNode node={formation} depth={0} onSelect={setSelectedNode} selected={selectedNode} />
            }
            {userId && isSupabaseConfigured ? (
              <div className="mt-auto border-t border-white/[0.07] pt-2">
                <div className="flex items-center gap-1.5 px-1 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">
                  <Cloud className="h-3 w-3" /> Brouillons
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1 pr-0.5">
                  {drafts.length === 0 ? (
                    <p className="text-[10px] text-white/20 px-1">Aucun</p>
                  ) : (
                    drafts.map((d) => (
                      <div key={d.id} className="flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.02] pr-0.5">
                        <button
                          type="button"
                          onClick={() => loadCloudDraft(d.id)}
                          disabled={draftBusy}
                          className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-[10px] text-white/55 hover:bg-white/[0.05] hover:text-white/85 disabled:opacity-40"
                        >
                          {d.title}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => removeCloudDraft(d.id, e)}
                          disabled={draftBusy}
                          className="shrink-0 rounded p-1 text-white/25 hover:bg-red-500/15 hover:text-red-300"
                          aria-label="Supprimer le brouillon"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
          {formation && (
            <div className="border-t border-white/[0.07] p-3 space-y-2">
              <div className="flex items-center gap-2 rounded-xl border border-[#5a8f52]/25 bg-[#5a8f52]/10 px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-[#7bb06a]" />
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-[#9cc48a]">Formation générée</div>
                  <div className="text-[10px] text-white/30 truncate">{result?.meta?.type_programme_label}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={sendToProduction}
                disabled={producing}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#c96544] py-2 text-[11px] font-bold text-white transition-all hover:bg-[#d97757] shadow-[0_0_14px_rgba(217,119,87,0.35)] disabled:opacity-60"
              >
                {producing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clapperboard className="h-3.5 w-3.5" />}
                {producing ? 'Envoi au poste production…' : 'Envoyer au poste production'}
              </button>
              {prodMsg ? <p className="text-[10px] text-red-300/80 px-0.5">{prodMsg}</p> : null}
              {userId && isSupabaseConfigured ? (
                <>
                  <button
                    type="button"
                    onClick={() => saveCloudDraft()}
                    disabled={draftBusy}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#d4924a]/30 bg-[#d4924a]/10 py-2 text-[11px] font-semibold text-[#ecc98f] hover:bg-[#d4924a]/20 disabled:opacity-40"
                  >
                    {draftBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    {draftCloudId ? 'Mettre à jour le brouillon' : 'Sauvegarder dans le cloud'}
                  </button>
                  {draftMsg ? <p className="text-[10px] text-white/35 px-0.5">{draftMsg}</p> : null}
                </>
              ) : null}
            </div>
          )}
        </aside>

        {/* Centre */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {!formation ? (
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-2xl px-8 py-8">
                <h2 className="text-[18px] font-bold text-white mb-1">Nouvelle formation</h2>
                <p className="mb-6 text-[13px] text-white/40">
                  <span className="inline-flex items-end gap-1 align-baseline">
                    <LiriWordmark size="kicker" className="text-white/45" subtleGlow />
                    <span>génère le squelette (modules, semaines, cours) — puis envoyez-le au poste production pour le rendu image par image.</span>
                  </span>
                </p>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                  <CreationForm onResult={handleResult} loading={loading} setLoading={setLoading} error={error} setError={setError} />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-2xl px-8 py-8">
                <div className="mb-5 flex items-center gap-3">
                  <button onClick={() => clearFormation()} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-white/45 transition-all hover:border-white/20 hover:text-white/80">
                    <RefreshCw className="h-3 w-3" /> Nouvelle formation
                  </button>
                  <button onClick={() => navigate('/studio/liri/cours')} className="flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-400 transition-all hover:bg-amber-500/20">
                    <Brain className="h-3.5 w-3.5" /> Générer un cours
                  </button>
                  <button onClick={sendToProduction} disabled={producing} className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#c96544] px-3.5 py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-[#d97757] shadow-[0_0_12px_rgba(217,119,87,0.35)] disabled:opacity-60">
                    {producing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clapperboard className="h-3.5 w-3.5" />}
                    Envoyer au poste production <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                {result?.meta?.bascule && result?.meta?.message ? (
                  <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#d4924a]/25 bg-[#d4924a]/10 px-3 py-2.5 text-[11.5px] leading-relaxed text-[#ecc98f]/90">
                    <RefreshCw className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    <span>{result.meta.message}</span>
                  </div>
                ) : null}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                  <DetailPanel node={selectedNode} />
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Droite */}
        <aside className="flex w-60 flex-shrink-0 flex-col border-l border-white/[0.07] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
            <Sparkles className="h-3.5 w-3.5 text-[#e08a5f]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">Assistant</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {!formation ? (
              <>
                <ACard icon={BookOpen} title="1 · Création (ici)" accent="violet" text="LIRI génère le squelette de la formation : modules, semaines, cours — selon la progression expérience → question → réflexion → démonstration → application." />
                <ACard icon={Clapperboard} title="2 · Poste production" accent="amber" text="Le squelette part au poste production : storyboard, image par image, vidéo source, support visuel, quiz — chaque jour se produit là-bas." />
                <ACard icon={Target} title="3 · Rendu élève" accent="emerald" text="Au poste production, contrôlez le rendu final (checklist qualité) puis publiez : la formation apparaît dans « Mes cours » des élèves." />
              </>
            ) : (
              <>
                <ACard icon={CheckCircle2} title="Formation prête" accent="emerald" text={`Structure générée avec ${result?.meta?.profil_rendu_label || 'le profil sélectionné'}. Sélectionnez un nœud dans l'arbre pour voir son détail.`} />
                <ACard icon={Clapperboard} title="Prochaine étape : production" accent="violet" text="Envoyez le squelette au poste production — 1 étape = 1 jour à produire (storyboard, image par image, vidéo, support, quiz). C'est là que la formation prend vie." />
                <ACard icon={Target} title="Puis : rendu élève" accent="amber" text="Depuis le poste production, la checklist qualité valide la chaîne création → post-production → rendu élève avant publication." />
              </>
            )}
          </div>
        </aside>
      </div>
    </StudioDesignerLikeShell>
  );
}
