/**
 * Step5Inviter — Invitations intelligentes (individuelle, classe, module, rôle)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { UserPicker } from '@/components/live/UserPicker';
import { supabase } from '@/lib/customSupabaseClient';
import {
  UserPlus, Users, BookOpen, Tag, ChevronDown, ChevronUp,
  X, Check, Loader2, Smartphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Rôles disponibles ──────────────────────────────────────────────────────
const ROLE_OPTIONS = [
  { value: 'teacher',           label: 'Enseignants',            emoji: '🎓' },
  { value: 'student',           label: 'Étudiants',              emoji: '📚' },
  { value: 'secretariat',       label: 'Secrétariat',            emoji: '🗂️' },
  { value: 'admin',             label: 'Administrateurs',        emoji: '⚙️' },
  { value: 'ngowazulu_member',  label: 'Membres NGOWAZULU',      emoji: '🌀' },
  { value: 'patient',           label: 'Patients',               emoji: '🌿' },
  { value: 'communaute_temple', label: 'Communauté Temple',      emoji: '🏛️' },
];

// ─── Tags pour modules ─────────────────────────────────────────────────────
const MODULE_PRESETS = [
  { id: 'cosmologie',  name: 'Cosmologie' },
  { id: 'ontologie',   name: 'Ontologie' },
  { id: 'karma',       name: 'Karma' },
  { id: 'libation',    name: 'Libation' },
  { id: 'kmt',         name: 'Kemit (KMT)' },
  { id: 'spiritualite',name: 'Spiritualité africaine' },
  { id: 'manikongo',   name: 'Manikongo' },
  { id: 'nganga',      name: 'Nganga' },
];

function InviteSection({ icon: Icon, title, desc, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0F1419]/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#7B61FF]/15 border border-[#7B61FF]/30 flex items-center justify-center">
            <Icon className="w-4 h-4 text-[#7B61FF]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{title}</p>
            {desc && <p className="text-xs text-white/40">{desc}</p>}
          </div>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-white/30" />
          : <ChevronDown className="w-4 h-4 text-white/30" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-white/[0.06] space-y-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Tag/pill removable ─────────────────────────────────────────────────────
function Pill({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-7 pl-3 pr-2 rounded-full bg-[#7B61FF]/15 border border-[#7B61FF]/30 text-[#7B61FF] text-xs font-medium">
      {label}
      <button type="button" onClick={onRemove} className="hover:bg-white/10 rounded-full p-0.5 transition-colors">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ─── Classes picker ─────────────────────────────────────────────────────────
function ClassesPicker({ selected, onChange }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from('classes')
      .select('id, name')
      .ilike('name', `%${search}%`)
      .limit(20)
      .then(({ data, error }) => {
        if (error) console.warn('[ClassesPicker] classes', error.message);
        if (!cancelled) setClasses(data || []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search]);

  const toggle = (cls) => {
    const already = selected.find((c) => c.id === cls.id);
    if (already) onChange(selected.filter((c) => c.id !== cls.id));
    else onChange([...selected, cls]);
  };

  return (
    <div className="space-y-2">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher une classe…"
        className="w-full h-9 bg-black/30 border border-white/10 rounded-xl px-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-[#7B61FF]/40 transition-colors"
      />
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((c) => (
            <Pill key={c.id} label={c.name} onRemove={() => toggle(c)} />
          ))}
        </div>
      )}
      {loading
        ? <Loader2 className="w-4 h-4 animate-spin text-white/30 mx-auto" />
        : (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {classes.map((cls) => {
              const active = selected.some((c) => c.id === cls.id);
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => toggle(cls)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors',
                    active
                      ? 'bg-[#7B61FF]/15 border border-[#7B61FF]/30 text-[#7B61FF]'
                      : 'bg-black/20 border border-white/[0.06] text-white/60 hover:text-white hover:border-white/15'
                  )}
                >
                  {cls.name}
                  {active && <Check className="w-3.5 h-3.5" />}
                </button>
              );
            })}
            {classes.length === 0 && !loading && (
              <p className="text-xs text-white/30 py-2 text-center">Aucune classe trouvée</p>
            )}
          </div>
        )
      }
    </div>
  );
}

// ─── Modules picker ─────────────────────────────────────────────────────────
function ModulesPicker({ selected, onChange }) {
  const [dbModules, setDbModules] = useState([]);

  useEffect(() => {
    supabase
      .from('formations')
      .select('id, title')
      .eq('is_module', true)
      .limit(30)
      .then(({ data, error }) => {
        if (error) console.warn('[ModulesPicker] formations', error.message);
        setDbModules((data || []).map((d) => ({ id: d.id, name: d.title })));
      });
  }, []);

  const allModules = [
    ...MODULE_PRESETS,
    ...dbModules.filter((m) => !MODULE_PRESETS.find((p) => p.name.toLowerCase() === m.name.toLowerCase())),
  ];

  const toggle = (mod) => {
    const already = selected.find((m) => m.id === mod.id);
    if (already) onChange(selected.filter((m) => m.id !== mod.id));
    else onChange([...selected, mod]);
  };

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((m) => (
            <Pill key={m.id} label={m.name} onRemove={() => toggle(m)} />
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {allModules.map((mod) => {
          const active = selected.some((m) => m.id === mod.id);
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => toggle(mod)}
              className={cn(
                'h-7 px-3 rounded-full border text-xs font-medium transition-all',
                active
                  ? 'bg-[#7B61FF]/20 border-[#7B61FF]/40 text-[#7B61FF]'
                  : 'bg-black/20 border-white/10 text-white/50 hover:border-white/25 hover:text-white'
              )}
            >
              {mod.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Roles picker ───────────────────────────────────────────────────────────
function RolesPicker({ selected, onChange }) {
  const toggle = (role) => {
    if (selected.includes(role)) onChange(selected.filter((r) => r !== role));
    else onChange([...selected, role]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {ROLE_OPTIONS.map((r) => {
        const active = selected.includes(r.value);
        return (
          <button
            key={r.value}
            type="button"
            onClick={() => toggle(r.value)}
            className={cn(
              'flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium transition-all',
              active
                ? 'bg-[#7B61FF]/20 border-[#7B61FF]/40 text-[#7B61FF]'
                : 'bg-black/20 border-white/10 text-white/50 hover:border-white/25 hover:text-white'
            )}
          >
            <span>{r.emoji}</span>
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Compteur total invitations ─────────────────────────────────────────────
function InviteSummary({ draft }) {
  const userCount   = draft.invited_users?.length || 0;
  const classCount  = draft.invited_classes?.length || 0;
  const moduleCount = draft.invited_modules?.length || 0;
  const roleCount   = draft.invited_roles?.length || 0;
  const total = userCount + classCount + moduleCount + roleCount;
  if (!total) return null;

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {userCount > 0   && <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/50">{userCount} utilisateur{userCount > 1 ? 's' : ''}</span>}
      {classCount > 0  && <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/50">{classCount} classe{classCount > 1 ? 's' : ''}</span>}
      {moduleCount > 0 && <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/50">{moduleCount} module{moduleCount > 1 ? 's' : ''}</span>}
      {roleCount > 0   && <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/50">{roleCount} rôle{roleCount > 1 ? 's' : ''}</span>}
    </div>
  );
}

// ─── Composant principal ────────────────────────────────────────────────────
export function Step5Inviter({ draft, updateDraft }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-1">Invitations</h2>
        <p className="text-gray-400 text-sm">
          Invitez des personnes, classes, modules ou groupes de rôles. Un{' '}
          <strong className="font-medium text-[#c4b5fd]/95">code court LIRI mobile</strong> est généré
          automatiquement à la validation finale pour rejoindre le live depuis l&apos;app (affiché dans la notification et sur l&apos;écran de chargement de l&apos;Arène).
        </p>
      </div>

      <InviteSummary draft={draft} />

      {/* A. Invitation individuelle */}
      <InviteSection
        icon={UserPlus}
        title="Invitation individuelle"
        desc="Ajouter des utilisateurs précis"
        defaultOpen
      >
        <UserPicker
          selected={draft.invited_users || []}
          onChange={(users) => updateDraft({ invited_users: users })}
          placeholder="Rechercher par nom ou email…"
        />
      </InviteSection>

      {/* B. Inviter une classe */}
      <InviteSection
        icon={Users}
        title="Inviter une classe"
        desc="Tous les membres de la classe sont invités automatiquement"
      >
        <ClassesPicker
          selected={draft.invited_classes || []}
          onChange={(v) => updateDraft({ invited_classes: v })}
        />
      </InviteSection>

      {/* C. Inviter les membres d'un module */}
      <InviteSection
        icon={BookOpen}
        title="Inviter un module"
        desc="Tous les inscrits au module reçoivent l'invitation"
      >
        <ModulesPicker
          selected={draft.invited_modules || []}
          onChange={(v) => updateDraft({ invited_modules: v })}
        />
      </InviteSection>

      {/* D. Inviter selon rôle */}
      <InviteSection
        icon={Tag}
        title="Inviter selon le rôle"
        desc="Cibler enseignants, membres NGOWAZULU, patients…"
      >
        <RolesPicker
          selected={draft.invited_roles || []}
          onChange={(v) => updateDraft({ invited_roles: v })}
        />
      </InviteSection>

      {/* E. LIRI mobile — code généré à la création */}
      <InviteSection
        icon={Smartphone}
        title="LIRI mobile — code d’accès"
        desc="Saisie du code dans l’app élève après création du live"
      >
        <div className="space-y-2 text-xs leading-relaxed text-white/55">
          <p>
            Dès que vous validez le live à l&apos;étape suivante, le système crée une session avec un{' '}
            <strong className="text-white/75">code à 8 caractères</strong> (affiché style{' '}
            <span className="font-mono text-[#c4b5fd]/90">XXXX-XXXX</span>). Les élèves ouvrent{' '}
            <strong className="text-white/75">LIRI mobile → Rejoindre avec un code</strong> et saisissent ce code
            (ou collent le lien web du live si vous le leur envoyez).
          </p>
          <p className="text-white/40">
            Les invitations individuelles, classes, modules et rôles ci-dessus restent traitées par le service
            d&apos;invitations (notifications selon votre configuration à l&apos;étape Sécurité).
          </p>
        </div>
      </InviteSection>

      {/* Options membres */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0F1419]/50 border border-white/10">
        <div className="flex items-center gap-3">
          <Users className="w-4 h-4 text-[#7B61FF]/70" />
          <div>
            <Label className="text-sm text-white/80 font-medium">Les membres peuvent inviter</Label>
            <p className="text-xs text-white/40">Permettre aux participants d'inviter d'autres personnes</p>
          </div>
        </div>
        <Switch
          checked={draft.allow_members_invite}
          onCheckedChange={(v) => updateDraft({ allow_members_invite: v })}
          className="data-[state=checked]:bg-[#7B61FF]"
        />
      </div>
    </div>
  );
}
