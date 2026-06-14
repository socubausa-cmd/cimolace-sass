import React from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, GraduationCap, Video, Presentation, Info } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SESSION_TYPES = [
  { value: 'classe', label: 'Classe virtuelle', icon: Video },
  { value: 'entretien', label: 'Entretien privé', icon: Presentation },
  { value: 'conference', label: 'Conférence', icon: Sparkles },
];

const CATEGORIES = [
  { value: 'formation', label: 'Formation', icon: GraduationCap },
  { value: 'mentorat', label: 'Mentorat', icon: Sparkles },
  { value: 'coaching', label: 'Coaching', icon: Presentation },
  { value: 'conference', label: 'Conférence', icon: Video },
  { value: 'autre', label: 'Autre', icon: Sparkles },
];

export function Step1Informations({ draft, updateDraft, isStaff, teachers, selectedTeacherId, onTeacherChange }) {
  const titleLen = String(draft.title || '').length;
  const descLen = String(draft.description || '').length;

  return (
    <div className="space-y-6">
      <div className="flex gap-3 sm:gap-4">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#7B61FF] bg-[#7B61FF]/12 text-[#7B61FF] shadow-[0_0_16px_-6px_rgba(123,97,255,0.35)]">
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
                <SelectItem key={t.id} value={t.id} className="rounded-lg focus:bg-[#7B61FF]/10 focus:text-[#7B61FF]">
                  {t.name || t.email || t.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              className="h-12 rounded-lg border-[#7B61FF]/50 bg-[#0a0c10] pr-16 text-white placeholder:text-gray-600 transition-all focus-visible:border-[#7B61FF] focus-visible:shadow-[0_0_0_2px_rgba(123,97,255,0.15)]"
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
              className="min-h-[120px] resize-y rounded-lg border-[#2D3139] bg-[#0a0c10] px-3 pb-7 pt-3 pr-16 text-white placeholder:text-gray-600 transition-all focus-visible:border-[#7B61FF]/70 focus-visible:shadow-[0_0_0_2px_rgba(123,97,255,0.12)]"
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
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#7B61FF]/28 text-[#B8A3FF]">
                  <Video className="h-4 w-4" />
                </span>
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-[#2D3139] bg-[#151a21]">
              {SESSION_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <SelectItem key={t.value} value={t.value} className="rounded-lg focus:bg-[#7B61FF]/10 focus:text-[#7B61FF]">
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
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B82F6]/24 text-[#93C5FD]">
                  <GraduationCap className="h-4 w-4" />
                </span>
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-[#2D3139] bg-[#151a21]">
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                return (
                  <SelectItem key={c.value} value={c.value} className="rounded-lg focus:bg-[#7B61FF]/10 focus:text-[#7B61FF]">
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
    </div>
  );
}
