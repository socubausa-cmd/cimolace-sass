import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useLiriEntitlements } from '@/hooks/useLiriEntitlements';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DURATIONS = [30, 45, 60, 90, 120];
const RECURRENCE = [
  { value: 'none', label: 'Aucune' },
  { value: 'daily', label: 'Quotidien' },
  { value: 'weekly', label: 'Hebdomadaire' },
  { value: 'monthly', label: 'Mensuel' },
];

export function Step3DateHoraire({ draft, updateDraft }) {
  const { isFree, limits } = useLiriEntitlements();
  const scheduleLocked = isFree && !limits.canSchedule;
  const dateStr = draft.scheduled_at ? (typeof draft.scheduled_at === 'string' && draft.scheduled_at.includes('T')
    ? draft.scheduled_at.slice(0, 10)
    : new Date(draft.scheduled_at).toISOString().slice(0, 10)) : '';

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-1">Date et horaire</h2>
        <p className="text-gray-400">Quand aura lieu votre session ?</p>
      </div>

      {scheduleLocked && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-100/90">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <span>
            <strong>Programmer un live à l'avance</strong> est réservé aux forfaits LIRI. En gratuit, lancez un live immédiat — ou{' '}
            <Link to="/cimolace/billing?upgrade=liri" className="font-semibold underline underline-offset-2 hover:text-white">passez à un forfait</Link> pour planifier.
          </span>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6 rounded-2xl border border-white/10 bg-[#0F1419]/50 p-4"
      >
        <div className="space-y-2">
          <Label className="text-gray-300">Date *</Label>
          <Input
            type="date"
            value={dateStr}
            onChange={(e) => updateDraft({ scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : '' })}
            className="h-12 rounded-xl bg-[#0F1419] border-white/10 text-white [color-scheme:dark]"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-gray-300">Heure</Label>
          <Input
            type="time"
            value={draft.scheduled_time || '14:00'}
            onChange={(e) => updateDraft({ scheduled_time: e.target.value })}
            className="h-12 rounded-xl bg-[#0F1419] border-white/10 text-white [color-scheme:dark]"
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6 rounded-2xl border border-white/10 bg-[#0F1419]/50 p-4"
      >
        <div className="space-y-2">
          <Label className="text-gray-300">Durée (minutes)</Label>
          <Select
            value={String(draft.duration_minutes || 60)}
            onValueChange={(v) => updateDraft({ duration_minutes: parseInt(v, 10) })}
          >
            <SelectTrigger className="h-12 rounded-xl bg-[#0F1419] border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#151a21] border-white/10 rounded-xl">
              {DURATIONS.map((d) => (
                <SelectItem key={d} value={String(d)} className="focus:bg-[#d97757]/10 focus:text-[#d97757] rounded-lg">
                  {d} min
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-gray-300">Fuseau horaire</Label>
          <Select value={draft.timezone} onValueChange={(v) => updateDraft({ timezone: v })}>
            <SelectTrigger className="h-12 rounded-xl bg-[#0F1419] border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#151a21] border-white/10 rounded-xl">
              <SelectItem value="Europe/Paris" className="focus:bg-[#d97757]/10 focus:text-[#d97757] rounded-lg">Paris</SelectItem>
              <SelectItem value="Africa/Kinshasa" className="focus:bg-[#d97757]/10 focus:text-[#d97757] rounded-lg">Kinshasa</SelectItem>
              <SelectItem value="UTC" className="focus:bg-[#d97757]/10 focus:text-[#d97757] rounded-lg">UTC</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="space-y-2 rounded-2xl border border-white/10 bg-[#0F1419]/50 p-4"
      >
        <Label className="text-gray-300">Récurrence</Label>
        <Select value={draft.recurrence || 'none'} onValueChange={(v) => updateDraft({ recurrence: v })}>
          <SelectTrigger className="h-12 rounded-xl bg-[#0F1419] border-white/10 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#151a21] border-white/10 rounded-xl">
            {RECURRENCE.map((r) => (
              <SelectItem key={r.value} value={r.value} className="focus:bg-[#d97757]/10 focus:text-[#d97757] rounded-lg">
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>
    </div>
  );
}
