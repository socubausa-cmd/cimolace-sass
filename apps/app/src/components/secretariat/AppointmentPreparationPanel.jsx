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
 * Soumet via POST /booking/appointments/:id/preparation (API NestJS v2).
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
    <div className="rounded-xl border border-black/[0.08] bg-white overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#F4F5F7] transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base">{step.icon}</span>
          <span className="text-sm font-medium text-[#18181B]">{step.label}</span>
          {data?.duration_min && (
            <span className="text-[10px] text-[#71717A] border border-black/[0.08] rounded px-1.5 py-0.5">{data.duration_min} min</span>
          )}
          {data?.content && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[#71717A]" /> : <ChevronDown className="w-4 h-4 text-[#71717A]" />}
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
                className="w-full resize-none rounded-lg bg-[#F4F5F7] border border-black/[0.08] px-3 py-2 text-sm text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] transition-colors"
              />
              <div className="flex items-center gap-3">
                <label className="text-xs text-[#71717A]">Durée :</label>
                <input
                  type="number"
                  min={1} max={60}
                  value={data?.duration_min || ''}
                  onChange={e => onChange({ ...data, step: step.step, title: step.label, duration_min: Number(e.target.value) || undefined })}
                  placeholder="min"
                  className="w-16 rounded-lg bg-[#F4F5F7] border border-black/[0.08] px-2 py-1 text-sm text-[#18181B] text-center focus:outline-none focus:border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)]"
                />
                <span className="text-xs text-[#71717A]">minutes</span>
                {data?.content && (
                  <button onClick={() => onRemoveContent(step.step)} className="ml-auto text-xs text-red-600 hover:text-red-700 flex items-center gap-1">
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

  /* Charger la préparation existante (via API NestJS — plus de Netlify v1) */
  useEffect(() => {
    if (!appointment?.id) return;
    import('@/lib/api').then(({ api }) => {
      api
        .get(`/booking/appointments/${appointment.id}/preparation`)
        .then((res) => {
          const data = res?.data?.data ?? res?.data ?? null;
          if (data) {
            const map = {};
            (data.plan_json || []).forEach(item => { map[item.step] = item; });
            setPlanMap(map);
            setRoomType(data.room_type || 'chat');
            setNotes(data.notes_secretary || '');
            setIsReady(data.is_ready || false);
          }
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
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
      const planJson = PLAN_STEPS
        .filter(s => planMap[s.step]?.content?.trim())
        .map(s => ({ ...planMap[s.step], step: s.step, title: s.label }));

      // API NestJS (auth + X-Tenant-Slug via interceptors) — remplace la fonction Netlify v1.
      const { api } = await import('@/lib/api');
      await api.post(`/booking/appointments/${appointment.id}/preparation`, {
        planJson,
        roomType,
        notesSecretary: notes.trim() || null,
        documentsJson: [],
        isReady,
        newStatus: newStatus || null,
      });

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

  /* Lancer la séance live à partir du rendez-vous (pont RDV→live). */
  const [startingLive, setStartingLive] = useState(false);
  const handleStartLive = async () => {
    if (!appointment?.id || startingLive) return;
    setStartingLive(true);
    try {
      const { bookingApi } = await import('@/lib/api');
      const res = await bookingApi.startLiveFromAppointment(appointment.id);
      const liveId = res?.liveSessionId;
      if (!liveId) throw new Error('Séance non créée');
      toast({ title: 'Séance prête', description: 'Ouverture de la salle hôte…' });
      window.location.href = `/live/host/${liveId}`;
    } catch (e) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setStartingLive(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-8 text-[#71717A]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  const currentStatus = String(appointment?.status || '');

  return (
    <div className="space-y-4 p-4 bg-[#F4F5F7]">
      {/* Header */}
      <div className="flex items-center gap-2">
        <List className="w-4 h-4 text-[#8A6D1A]" />
        <p className="text-sm font-semibold text-[#18181B]">Studio de préparation</p>
        <span className="ml-auto text-[10px] text-[#71717A] border border-black/[0.08] rounded px-2 py-0.5">§3 & §8</span>
      </div>

      {/* Type de salle */}
      <div className="space-y-1.5">
        <label className="text-xs text-[#71717A] uppercase tracking-wider">Type de salle</label>
        <div className="flex gap-2">
          {ROOM_TYPES.map(rt => (
            <button
              key={rt.value}
              onClick={() => setRoomType(rt.value)}
              className={`flex-1 flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-medium transition-all ${
                roomType === rt.value
                  ? 'border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[#8A6D1A]'
                  : 'border-black/[0.08] bg-white text-[#71717A] hover:border-black/25'
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
        <label className="text-xs text-[#71717A] uppercase tracking-wider flex items-center gap-1.5">
          <Plus className="w-3 h-3" /> Plan de l'entretien
          <span className="text-[#A1A1AA]">(cliquer pour développer)</span>
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
        <label className="text-xs text-[#71717A] uppercase tracking-wider flex items-center gap-1.5">
          <FileText className="w-3 h-3" /> Notes internes
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Observations, contexte, points de vigilance avant la séance…"
          rows={2}
          className="w-full resize-none rounded-xl bg-white border border-black/[0.08] px-3 py-2.5 text-sm text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] transition-colors"
        />
      </div>

      {/* Activer la Smart Room */}
      <div className="flex items-center gap-3 rounded-xl border border-black/[0.08] bg-white px-4 py-3">
        <button
          onClick={() => setIsReady(r => !r)}
          className={`w-10 h-5 rounded-full transition-all flex items-center px-0.5 ${isReady ? 'bg-[var(--school-accent)]' : 'bg-zinc-300'}`}
        >
          <motion.div className="w-4 h-4 rounded-full bg-white shadow" animate={{ x: isReady ? 20 : 0 }} transition={{ type: 'spring', stiffness: 300 }} />
        </button>
        <div>
          <p className="text-sm text-[#18181B] font-medium">Séance prête</p>
          <p className="text-xs text-[#71717A]">Active le bouton "Rejoindre" pour le client</p>
        </div>
      </div>

      {/* Changer le statut */}
      {['confirmed','scheduled','preparing'].includes(currentStatus) && (
        <div className="space-y-1.5">
          <label className="text-xs text-[#71717A] uppercase tracking-wider">Changer le statut</label>
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
                      ? 'bg-blue-50 border-blue-400 text-blue-700'
                      : 'bg-violet-50 border-violet-400 text-violet-700'
                    : 'bg-white border-black/[0.08] text-[#71717A] hover:border-black/25'
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

      {/* Pont RDV → séance live */}
      <Button
        onClick={handleStartLive}
        disabled={startingLive}
        variant="outline"
        className="mt-2 w-full flex items-center justify-center gap-2"
      >
        {startingLive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
        Lancer la séance live
      </Button>
    </div>
  );
}
