/**
 * AppointmentPreparationPanel — §8 Rôle du secrétaire
 *
 * Permet au secrétariat de :
 *   - Construire le plan de l'entretien (6 étapes)
 *   - Définir le type de salle (chat / live / chat_then_live)
 *   - Ajouter des notes internes
 *   - Marquer la séance comme prête (is_ready)
 *   - Changer le statut : confirmed → preparing → ready
 *
 * Soumet via POST /booking-set-preparation.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  List, MessageSquare, Video, ChevronDown, ChevronUp,
  Save, Loader2, Zap, CheckCircle2, FileText, Plus, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const PLAN_STEPS = [
  { step: 'introduction',  label: 'Introduction',   icon: '👋', placeholder: 'Accueil, présentation, mise en confiance…' },
  { step: 'definition',    label: 'Définition',     icon: '📖', placeholder: 'Contexte, qu\'est-ce que Prorascience…' },
  { step: 'analyse',       label: 'Analyse',        icon: '🔍', placeholder: 'Analyse du profil et des besoins du visiteur…' },
  { step: 'cas_pratiques', label: 'Cas pratiques',  icon: '💡', placeholder: 'Exemples concrets, témoignages, cas réussis…' },
  { step: 'orientation',   label: 'Orientation',    icon: '🎯', placeholder: 'Recommandation de formation, cycle, parcours…' },
  { step: 'conclusion',    label: 'Conclusion',     icon: '✅', placeholder: 'Synthèse, prochaines étapes, prise de décision…' },
];

const ROOM_TYPES = [
  { value: 'chat',          label: 'Chat immersif',         icon: MessageSquare },
  { value: 'live',          label: 'Live vidéo',            icon: Video },
  { value: 'chat_then_live', label: 'Chat puis Live',       icon: Zap },
];

function StepEditor({ step, data, onChange, onRemoveContent }) {
  const [open, setOpen] = useState(Boolean(data?.content));

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base">{step.icon}</span>
          <span className="text-sm font-medium text-white">{step.label}</span>
          {data?.duration_min && (
            <span className="text-[10px] text-gray-500 border border-white/10 rounded px-1.5 py-0.5">{data.duration_min} min</span>
          )}
          {data?.content && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-2.5">
              <textarea
                value={data?.content || ''}
                onChange={e => onChange({ ...data, step: step.step, title: step.label, content: e.target.value })}
                placeholder={step.placeholder}
                rows={2}
                className="w-full resize-none rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] transition-colors"
              />
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-500">Durée :</label>
                <input
                  type="number"
                  min={1} max={60}
                  value={data?.duration_min || ''}
                  onChange={e => onChange({ ...data, step: step.step, title: step.label, duration_min: Number(e.target.value) || undefined })}
                  placeholder="min"
                  className="w-16 rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)]"
                />
                <span className="text-xs text-gray-500">minutes</span>
                {data?.content && (
                  <button onClick={() => onRemoveContent(step.step)} className="ml-auto text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Effacer
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AppointmentPreparationPanel({ appointment, session, onStatusChange }) {
  const { toast } = useToast();
  const [planMap, setPlanMap]         = useState({}); // { step: { step, title, content, duration_min } }
  const [roomType, setRoomType]       = useState('chat');
  const [notes, setNotes]             = useState('');
  const [isReady, setIsReady]         = useState(false);
  const [newStatus, setNewStatus]     = useState(null);
  const [saving, setSaving]           = useState(false);
  const [loaded, setLoaded]           = useState(false);

  /* Charger la préparation existante */
  useEffect(() => {
    if (!appointment?.id) return;
    import('@/lib/customSupabaseClient').then(({ supabase }) => {
      supabase
        .from('appointment_preparation')
        .select('plan_json, room_type, notes_secretary, is_ready')
        .eq('appointment_id', appointment.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            const map = {};
            (data.plan_json || []).forEach(item => { map[item.step] = item; });
            setPlanMap(map);
            setRoomType(data.room_type || 'chat');
            setNotes(data.notes_secretary || '');
            setIsReady(data.is_ready || false);
          }
          setLoaded(true);
        });
    });
  }, [appointment?.id]);

  const handleStepChange = (stepData) => {
    setPlanMap(prev => ({ ...prev, [stepData.step]: stepData }));
  };

  const handleRemoveContent = (stepKey) => {
    setPlanMap(prev => {
      const next = { ...prev };
      delete next[stepKey];
      return next;
    });
  };

  const handleSave = async () => {
    if (!appointment?.id || saving) return;
    setSaving(true);
    try {
      const token = session?.access_token;
      if (!token) throw new Error('Session expirée');

      const planJson = PLAN_STEPS
        .filter(s => planMap[s.step]?.content?.trim())
        .map(s => ({ ...planMap[s.step], step: s.step, title: s.label }));

      const res = await fetch('/.netlify/functions/booking-set-preparation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          appointmentId:  appointment.id,
          planJson,
          roomType,
          notesSecretary: notes.trim() || null,
          documentsJson:  [],
          isReady,
          newStatus:      newStatus || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur serveur');

      toast({ title: 'Préparation enregistrée', description: newStatus ? `Statut → ${newStatus}` : 'Plan sauvegardé avec succès.' });
      if (newStatus) {
        onStatusChange?.({ ...appointment, status: newStatus });
        setNewStatus(null);
      }
    } catch (e) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  const currentStatus = String(appointment?.status || '');

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <List className="w-4 h-4 text-[var(--school-accent)]" />
        <p className="text-sm font-semibold text-white">Studio de préparation</p>
        <span className="ml-auto text-[10px] text-gray-500 border border-white/10 rounded px-2 py-0.5">§3 & §8</span>
      </div>

      {/* Type de salle */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-500 uppercase tracking-wider">Type de salle</label>
        <div className="flex gap-2">
          {ROOM_TYPES.map(rt => (
            <button
              key={rt.value}
              onClick={() => setRoomType(rt.value)}
              className={`flex-1 flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-medium transition-all ${
                roomType === rt.value
                  ? 'border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[var(--school-accent)]'
                  : 'border-white/10 bg-white/5 text-gray-500 hover:border-white/25'
              }`}
            >
              <rt.icon className="w-4 h-4" />
              {rt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Plan de l'entretien */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <Plus className="w-3 h-3" /> Plan de l'entretien
          <span className="text-gray-600">(cliquer pour développer)</span>
        </label>
        <div className="space-y-2">
          {PLAN_STEPS.map(step => (
            <StepEditor
              key={step.step}
              step={step}
              data={planMap[step.step]}
              onChange={handleStepChange}
              onRemoveContent={handleRemoveContent}
            />
          ))}
        </div>
      </div>

      {/* Notes internes */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <FileText className="w-3 h-3" /> Notes internes
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Observations, contexte, points de vigilance avant la séance…"
          rows={2}
          className="w-full resize-none rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] transition-colors"
        />
      </div>

      {/* Activer la Smart Room */}
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <button
          onClick={() => setIsReady(r => !r)}
          className={`w-10 h-5 rounded-full transition-all flex items-center px-0.5 ${isReady ? 'bg-[var(--school-accent)]' : 'bg-white/20'}`}
        >
          <motion.div className="w-4 h-4 rounded-full bg-white shadow" animate={{ x: isReady ? 20 : 0 }} transition={{ type: 'spring', stiffness: 300 }} />
        </button>
        <div>
          <p className="text-sm text-white font-medium">Séance prête</p>
          <p className="text-xs text-gray-500">Active le bouton "Rejoindre" pour le client</p>
        </div>
      </div>

      {/* Changer le statut */}
      {['confirmed','scheduled','preparing'].includes(currentStatus) && (
        <div className="space-y-1.5">
          <label className="text-xs text-gray-500 uppercase tracking-wider">Changer le statut</label>
          <div className="flex gap-2">
            {[
              { value: 'preparing', label: 'En préparation', color: 'blue'   },
              { value: 'ready',     label: 'Prêt',           color: 'violet' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setNewStatus(v => v === opt.value ? null : opt.value)}
                className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-all ${
                  newStatus === opt.value
                    ? opt.color === 'blue'
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                      : 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                    : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/25'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Save */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-[var(--school-accent)] text-black hover:bg-amber-400 font-bold flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {isReady ? 'Enregistrer & activer la salle' : 'Enregistrer la préparation'}
      </Button>
    </div>
  );
}
