/**
 * Step4Securite — Visibilité, accès et salle d'attente (Smart Entry)
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Lock, Eye, EyeOff, Users, DoorOpen, Volume2, FileText,
  Bell, Mail, Clock, ShieldCheck, Key, CheckCircle, MessageSquare, Smartphone, Ticket,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ACCESS_MODES = [
  {
    id: 'free',
    icon: DoorOpen,
    label: 'Accès libre',
    desc: 'Toute personne invitée peut entrer directement.',
    color: 'emerald',
  },
  {
    id: 'password',
    icon: Key,
    label: 'Mot de passe',
    desc: 'L\'invité doit saisir le mot de passe du live.',
    color: 'blue',
  },
  {
    id: 'manual',
    icon: CheckCircle,
    label: 'Validation hôte',
    desc: 'L\'hôte accepte ou refuse chaque entrée.',
    color: 'violet',
  },
  {
    id: 'double',
    icon: ShieldCheck,
    label: 'Double validation',
    desc: 'Mot de passe + approbation manuelle de l\'hôte.',
    color: 'purple',
  },
  {
    id: 'paid',
    icon: Ticket,
    label: 'Payant',
    desc: 'L\'invité paie pour accéder — checkout puis accès débloqué automatiquement.',
    color: 'amber',
  },
];

const COLOR_MAP = {
  emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  blue:    'border-blue-500/40 bg-blue-500/10 text-blue-300',
  violet:  'border-[#d97757]/40 bg-[#d97757]/10 text-[#d97757]',
  purple:  'border-purple-500/40 bg-purple-500/10 text-purple-300',
  amber:   'border-amber-500/40 bg-amber-500/10 text-amber-300',
};

const VISIBILITY_OPTIONS = [
  { value: 'secret', icon: EyeOff, label: 'Secret', desc: 'Élèves invisibles entre eux' },
  { value: 'public', icon: Eye,    label: 'Public',  desc: 'Élèves visibles entre eux' },
];

function SectionTitle({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-8 h-8 rounded-xl bg-[#d97757]/15 border border-[#d97757]/30 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-[#d97757]" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        {desc && <p className="text-xs text-white/40 mt-0.5">{desc}</p>}
      </div>
    </div>
  );
}

function ToggleRow({ icon: Icon, label, desc, checked, onChange }) {
  return (
    <div className="flex items-center justify-between p-3.5 rounded-xl bg-black/20 border border-white/[0.06] hover:border-white/10 transition-colors">
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4 text-[#d97757]/70 flex-shrink-0" />
        <div>
          <p className="text-sm text-white/80 font-medium">{label}</p>
          {desc && <p className="text-xs text-white/40">{desc}</p>}
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-[#d97757]"
      />
    </div>
  );
}

export function Step4Securite({ draft, updateDraft }) {
  const needsPassword = draft.access_mode === 'password' || draft.access_mode === 'double';
  const isPaid = draft.access_mode === 'paid';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-1">Sécurité & Accès</h2>
        <p className="text-gray-400 text-sm">Contrôlez qui peut rejoindre et comment.</p>
      </div>

      {/* ── Visibilité ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/10 bg-[#0F1419]/40 p-4 md:p-5 space-y-3"
      >
        <SectionTitle icon={Eye} title="Visibilité" desc="Qui peut voir et rejoindre ce live ?" />

        <ToggleRow
          icon={Lock}
          label="Live public"
          desc="Visible par tous les membres de la plateforme"
          checked={draft.is_public}
          onChange={(v) => updateDraft({ is_public: v })}
        />

        {/* Mode classroom */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {VISIBILITY_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = draft.visibility_mode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateDraft({ visibility_mode: opt.value })}
                className={cn(
                  'flex items-center gap-2 p-3 rounded-xl border text-left transition-all',
                  active
                    ? 'border-[#d97757]/40 bg-[#d97757]/10 text-[#d97757]'
                    : 'border-white/10 bg-black/20 text-white/50 hover:border-white/20'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold">{opt.label}</p>
                  <p className="text-[10px] opacity-60">{opt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ── Mode d'accès ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="rounded-2xl border border-white/10 bg-[#0F1419]/40 p-4 md:p-5 space-y-3"
      >
        <SectionTitle icon={ShieldCheck} title="Mode d'accès" desc="Comment les invités entrent-ils dans le live ?" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ACCESS_MODES.map((mode) => {
            const Icon = mode.icon;
            const active = draft.access_mode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => updateDraft({ access_mode: mode.id })}
                className={cn(
                  'flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all',
                  active ? COLOR_MAP[mode.color] : 'border-white/10 bg-black/20 text-white/50 hover:border-white/20'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold">{mode.label}</p>
                  <p className="text-[10px] opacity-70 leading-relaxed mt-0.5">{mode.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {needsPassword && (
          <div className="pt-1 space-y-1.5">
            <Label className="text-xs text-white/50 flex items-center gap-1.5">
              <Key className="w-3 h-3" /> Mot de passe du live
            </Label>
            <Input
              type="password"
              value={draft.password || ''}
              onChange={(e) => updateDraft({ password: e.target.value })}
              placeholder="Entrer le mot de passe…"
              className="h-10 rounded-xl bg-[#0F1419] border-white/10 text-white text-sm"
            />
          </div>
        )}

        {isPaid && (
          <div className="pt-1 space-y-1.5">
            <Label className="text-xs text-white/50 flex items-center gap-1.5">
              <Ticket className="w-3 h-3" /> Prix d'accès au live
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={draft.price_cents ? draft.price_cents / 100 : ''}
                onChange={(e) => updateDraft({ price_cents: Math.max(0, Math.round(Number(e.target.value || 0) * 100)) })}
                placeholder="0"
                className="h-10 flex-1 rounded-xl bg-[#0F1419] border-white/10 text-white text-sm"
              />
              <select
                value={draft.currency || 'EUR'}
                onChange={(e) => updateDraft({ currency: e.target.value })}
                className="h-10 px-3 rounded-xl bg-[#0F1419] border border-white/10 text-white text-sm outline-none"
              >
                <option value="EUR">EUR €</option>
                <option value="XAF">XAF</option>
                <option value="XOF">XOF</option>
              </select>
            </div>
            <p className="text-[10px] text-white/40 leading-relaxed">
              L'invité verra « Payer pour accéder » → paiement → accès débloqué (un pass est posé automatiquement au paiement confirmé).
            </p>
          </div>
        )}
      </motion.div>

      {/* ── Salle d'attente ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="rounded-2xl border border-white/10 bg-[#0F1419]/40 p-4 md:p-5 space-y-3"
      >
        <SectionTitle icon={DoorOpen} title="Salle d'attente" desc="Espace actif avant l'entrée dans l'arena." />

        <ToggleRow
          icon={DoorOpen}
          label="Activer la salle d'attente"
          desc="Les invités arrivent dans un salon avant d'entrer"
          checked={draft.waiting_room}
          onChange={(v) => updateDraft({ waiting_room: v })}
        />

        {draft.waiting_room && (
          <div className="space-y-2 pl-1">
            <ToggleRow
              icon={Volume2}
              label="Audio du live en salle d'attente"
              desc="Les invités entendent le live en attendant"
              checked={draft.waiting_room_audio_enabled}
              onChange={(v) => updateDraft({ waiting_room_audio_enabled: v })}
            />
            <ToggleRow
              icon={FileText}
              label="Afficher le plan du live"
              desc="Visible dans la salle d'attente"
              checked={draft.waiting_room_show_plan}
              onChange={(v) => updateDraft({ waiting_room_show_plan: v })}
            />
            <ToggleRow
              icon={Eye}
              label="Afficher les détails du live"
              desc="Titre, thème, hôte, heure"
              checked={draft.waiting_room_show_details}
              onChange={(v) => updateDraft({ waiting_room_show_details: v })}
            />
            <div className="pt-1 space-y-1.5">
              <Label className="text-xs text-white/50 flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3" /> Message d'accueil personnalisé
              </Label>
              <Textarea
                value={draft.waiting_room_welcome_message || ''}
                onChange={(e) => updateDraft({ waiting_room_welcome_message: e.target.value })}
                placeholder="Bienvenue ! Votre séance commence dans quelques instants…"
                rows={3}
                className="bg-[#0F1419] border-white/10 text-white text-sm resize-none rounded-xl"
              />
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Notifications ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="rounded-2xl border border-white/10 bg-[#0F1419]/40 p-4 md:p-5 space-y-3"
      >
        <SectionTitle icon={Bell} title="Notifications" desc="Alerter les invités de la session." />

        <ToggleRow
          icon={Bell}
          label="Notification tableau de bord"
          desc="Alerte dans le dashboard des invités"
          checked={draft.notify_dashboard}
          onChange={(v) => updateDraft({ notify_dashboard: v })}
        />
        <ToggleRow
          icon={Mail}
          label="Notification email"
          desc="Email avec lien et résumé du live"
          checked={draft.notify_email}
          onChange={(v) => updateDraft({ notify_email: v })}
        />
        <ToggleRow
          icon={Smartphone}
          label="Notification WhatsApp"
          desc="Message WhatsApp (Twilio) si le numéro est renseigné sur le profil"
          checked={draft.notify_whatsapp === true}
          onChange={(v) => updateDraft({ notify_whatsapp: v })}
        />
        {(draft.notify_dashboard || draft.notify_email || draft.notify_whatsapp) && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-white/[0.06]">
            <Clock className="w-4 h-4 text-white/40 flex-shrink-0" />
            <p className="text-xs text-white/50">Rappel</p>
            <select
              value={draft.reminder_before_minutes || 15}
              onChange={(e) => updateDraft({ reminder_before_minutes: Number(e.target.value) })}
              className="ml-auto h-7 px-2 rounded-lg bg-[#0F1419] border border-white/10 text-white text-xs outline-none"
            >
              <option value={5}>5 min avant</option>
              <option value={15}>15 min avant</option>
              <option value={30}>30 min avant</option>
              <option value={60}>1h avant</option>
            </select>
          </div>
        )}
      </motion.div>
    </div>
  );
}
