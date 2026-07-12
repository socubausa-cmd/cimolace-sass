import React from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, GraduationCap, Video, Presentation, Info, Swords, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';

// Type de live → pilote l'affichage par défaut en salle (cf. arenaLayoutForSessionType) :
// Formation → SmartBoard · Conférence → grille membres · Débat → panel débatteurs.
// `medical: true` = réservé au Live santé (MEDOS) ; grisé hors mode MEDOS (et
// inversement, les types non-médicaux sont grisés EN mode MEDOS).
const SESSION_TYPES = [
  { value: 'teleconsult', label: 'Téléconsultation', icon: Stethoscope, medical: true },
  { value: 'classe', label: 'Formation', icon: GraduationCap }, // → mappé 'class' à la création
  { value: 'conference', label: 'Conférence', icon: Sparkles },
  { value: 'debate', label: 'Débat', icon: Swords },
];

const CATEGORIES = [
  { value: 'teleconsultation', label: 'Téléconsultation', icon: Stethoscope, medical: true },
  { value: 'formation', label: 'Formation', icon: GraduationCap },
  { value: 'mentorat', label: 'Mentorat', icon: Sparkles },
  { value: 'coaching', label: 'Coaching', icon: Presentation },
  { value: 'conference', label: 'Conférence', icon: Video },
  { value: 'autre', label: 'Autre', icon: Sparkles },
];

export function Step1Informations({ draft, updateDraft, isStaff, teachers, selectedTeacherId, onTeacherChange }) {
  const titleLen = String(draft.title || '').length;
  const descLen = String(draft.description || '').length;

  // Formations publiées du tenant (scopées par RLS) → rattacher le live à un cours.
  const [formations, setFormations] = React.useState([]);
  React.useEffect(() => {
    let alive = true;
    supabase
      .from('courses')
      .select('id, title')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (alive) setFormations(Array.isArray(data) ? data : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const isFormationLive = draft.session_type === 'classe' || draft.session_type === 'formation';

  // Cloison MEDOS : en Live santé, Type + Catégorie sont forcés sur « Téléconsultation »
  // (les autres — Formation, Conférence, Débat… — sont grisés). Hors MEDOS, on restaure
  // des valeurs Formation. Piloté par le seul basculement du mode (aussi au montage
  // quand le brouillon arrive déjà en medos_mode, ex. préparé depuis MEDOS).
  React.useEffect(() => {
    const patch = {};
    if (draft.medos_mode) {
      if (draft.session_type !== 'teleconsult') patch.session_type = 'teleconsult';
      if (draft.category !== 'teleconsultation') patch.category = 'teleconsultation';
    } else {
      if (draft.session_type === 'teleconsult') patch.session_type = 'classe';
      if (draft.category === 'teleconsultation') patch.category = 'formation';
    }
    if (Object.keys(patch).length) updateDraft(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.medos_mode]);

  return (
    <div className="space-y-6">
      <div className="flex gap-3 sm:gap-4">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d97757] bg-[#d97757]/12 text-[#d97757] shadow-[0_0_16px_-6px_rgba(217,119,87,0.35)]">
          <Info className="h-4 w-4 stroke-[2.5]" />
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-xl font-semibold tracking-tight text-white sm:text-[1.35rem]">Informations du live</h2>
          <p className="mt-1 text-sm text-gray-500">Donnez un titre et une description à votre session.</p>
        </div>
      </div>

      {isStaff && teachers?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2 rounded-lg border border-[#2D3139]/90 bg-[#0a0c10]/50 p-4"
        >
          <Label className="text-white/90">Enseignant</Label>
          <Select value={selectedTeacherId || ''} onValueChange={onTeacherChange}>
            <SelectTrigger className="h-12 rounded-lg border-[#2D3139] bg-[#0a0c10] text-white">
              <SelectValue placeholder="Sélectionner un enseignant" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-[#2D3139] bg-[#151a21]">
              {teachers.map((t) => (
                <SelectItem key={t.id} value={t.id} className="rounded-lg focus:bg-[#d97757]/10 focus:text-[#d97757]">
                  {t.name || t.email || t.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>
      )}

      {isFormationLive && formations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2 rounded-lg border border-[#2D3139]/90 bg-[#0a0c10]/50 p-4"
        >
          <Label className="flex items-center gap-1.5 text-white/90">
            <GraduationCap className="h-4 w-4 text-[#d97757]" /> Formation rattachée
            <span className="text-xs font-normal text-white/40">(optionnel)</span>
          </Label>
          <Select
            value={draft.formation_id || '__none__'}
            onValueChange={(v) => updateDraft({ formation_id: v === '__none__' ? null : v })}
          >
            <SelectTrigger className="h-12 rounded-lg border-[#2D3139] bg-[#0a0c10] text-white">
              <SelectValue placeholder="Rattacher ce live à un cours" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-[#2D3139] bg-[#151a21]">
              <SelectItem value="__none__" className="rounded-lg">Aucune formation</SelectItem>
              {formations.map((f) => (
                <SelectItem key={f.id} value={f.id} className="rounded-lg focus:bg-[#d97757]/10 focus:text-[#d97757]">
                  {f.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-white/40">Le live sera rattaché à cette formation (accessible depuis le cours).</p>
        </motion.div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-white">Titre *</Label>
          <div className="relative">
            <Input
              value={draft.title}
              onChange={(e) => updateDraft({ title: e.target.value })}
              placeholder="ex: Classe virtuelle Module 2 — Cosmologie"
              maxLength={100}
              className="h-12 rounded-lg border-[#d97757]/50 bg-[#0a0c10] pr-16 text-white placeholder:text-gray-600 transition-all focus-visible:border-[#d97757] focus-visible:shadow-[0_0_0_2px_rgba(217,119,87,0.15)]"
            />
            <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] tabular-nums text-gray-500">
              {titleLen} / 100
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-white">Description</Label>
          <div className="relative">
            <Textarea
              value={draft.description}
              onChange={(e) => updateDraft({ description: e.target.value })}
              placeholder="Décrivez le contenu et les objectifs de cette session..."
              rows={4}
              maxLength={500}
              className="min-h-[120px] resize-y rounded-lg border-[#2D3139] bg-[#0a0c10] px-3 pb-7 pt-3 pr-16 text-white placeholder:text-gray-600 transition-all focus-visible:border-[#d97757]/70 focus-visible:shadow-[0_0_0_2px_rgba(217,119,87,0.12)]"
            />
            <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] tabular-nums text-gray-500">
              {descLen} / 500
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 border-t border-[#2D3139]/70 pt-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-white/90">Type de live</Label>
          <Select value={draft.session_type} onValueChange={(v) => updateDraft({ session_type: v })}>
            <SelectTrigger className="h-12 rounded-lg border-[#2D3139] bg-[#0a0c10] px-3 text-white">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#d97757]/28 text-[#B8A3FF]">
                  {draft.medos_mode ? <Stethoscope className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                </span>
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-[#2D3139] bg-[#151a21]">
              {SESSION_TYPES.map((t) => {
                const Icon = t.icon;
                // Grisé : type médical hors MEDOS, ou type non-médical en mode MEDOS.
                const disabled = draft.medos_mode ? !t.medical : !!t.medical;
                return (
                  <SelectItem key={t.value} value={t.value} disabled={disabled} className="rounded-lg focus:bg-[#d97757]/10 focus:text-[#d97757]">
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-white/90">Catégorie</Label>
          <Select value={draft.category} onValueChange={(v) => updateDraft({ category: v })}>
            <SelectTrigger className="h-12 rounded-lg border-[#2D3139] bg-[#0a0c10] px-3 text-white">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#cf7a52]/24 text-[#e8c3a0]">
                  {draft.medos_mode ? <Stethoscope className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
                </span>
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-[#2D3139] bg-[#151a21]">
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                // Grisé : catégorie médicale hors MEDOS, ou catégorie non-médicale en mode MEDOS.
                const disabled = draft.medos_mode ? !c.medical : !!c.medical;
                return (
                  <SelectItem key={c.value} value={c.value} disabled={disabled} className="rounded-lg focus:bg-[#d97757]/10 focus:text-[#d97757]">
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" />
                      {c.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Live santé (MEDOS) : active le cockpit clinique embarqué (jumeau 3D / roue / bilans / SOAP). */}
      <button
        type="button"
        onClick={() => updateDraft({ medos_mode: !draft.medos_mode })}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition-colors',
          draft.medos_mode
            ? 'border-[#d97757]/45 bg-[#d97757]/[0.08]'
            : 'border-[#2D3139] bg-[#0a0c10]/60 hover:border-[#d97757]/30',
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              draft.medos_mode ? 'bg-[#d97757] text-white' : 'bg-[#d97757]/20 text-[#d97757]',
            )}
          >
            <Stethoscope className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-white">Live santé (MEDOS)</p>
            <p className="text-[12px] leading-snug text-gray-400">
              Cockpit clinique embarqué : jumeau 3D, roue de transformation, bilans et note SOAP à partager au patient.
            </p>
          </div>
        </div>
        <span
          className={cn(
            'relative h-6 w-11 shrink-0 rounded-full transition-colors',
            draft.medos_mode ? 'bg-[#d97757]' : 'bg-white/15',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
              draft.medos_mode ? 'translate-x-[22px]' : 'translate-x-0.5',
            )}
          />
        </span>
      </button>

      {draft.session_type === 'debate' ? (
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-[#d97757]/30 bg-[#d97757]/[0.06] p-4 md:grid-cols-2">
          <div className="md:col-span-2 -mb-1 flex items-center gap-2 text-[13px] font-medium text-[#B8A3FF]">
            <Swords className="h-4 w-4" /> Paramètres du débat
          </div>
          <div className="space-y-2">
            <Label className="text-white/90">Nombre de manches</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={draft.debate_round_count}
              onChange={(e) => updateDraft({ debate_round_count: e.target.value })}
              className="h-12 rounded-lg border-[#2D3139] bg-[#0a0c10] text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/90">Durée par tour (min)</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={draft.debate_minutes_per_turn}
              onChange={(e) => updateDraft({ debate_minutes_per_turn: e.target.value })}
              className="h-12 rounded-lg border-[#2D3139] bg-[#0a0c10] text-white"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
