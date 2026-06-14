import React from 'react';
import { motion } from 'framer-motion';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Save, Calendar, Zap, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { buildLiriAudioConfigPatch } from '@/lib/liriAudioScene';

const SESSION_TYPES = { classe: 'Classe virtuelle', entretien: 'Entretien privé', conference: 'Conférence' };

/** Step3 peut stocker `scheduled_at` en ISO complète ; éviter `…T14:00` concaténé → date invalide. */
function scheduledAtIsoFromDraft(draft) {
  if (!draft.scheduled_at) return new Date().toISOString();
  const raw = draft.scheduled_at;
  const time = draft.scheduled_time || '14:00';
  const datePart = typeof raw === 'string' && raw.includes('T')
    ? raw.slice(0, 10)
    : String(raw).slice(0, 10);
  const [hh, mm] = String(time).split(':');
  const d = new Date(
    `${datePart}T${String(hh || '14').padStart(2, '0')}:${String(mm || '00').padStart(2, '0')}:00`,
  );
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function buildConfig(draft) {
  return {
    // Salle virtuelle
    cover_image_url:           draft.cover_image_url,
    duration_minutes:          draft.duration_minutes,
    chat_enabled:              draft.chat_enabled,
    hand_raise_enabled:        draft.hand_raise_enabled,
    screen_share_enabled:      draft.screen_share_enabled,
    student_audio_enabled:     draft.student_audio_enabled,
    student_video_enabled:     draft.student_video_enabled,
    recording_enabled:         draft.recording_enabled,
    // LIRI — Sécurité & Salle d'attente
    access_mode:               draft.access_mode || 'free',
    waiting_room:              draft.waiting_room !== false,
    waiting_room_audio_enabled:  draft.waiting_room_audio_enabled || false,
    waiting_room_show_plan:      draft.waiting_room_show_plan || false,
    waiting_room_show_details:   draft.waiting_room_show_details !== false,
    waiting_room_welcome_message: draft.waiting_room_welcome_message || '',
    manual_approval:           draft.manual_approval || false,
    invite_only:               draft.invite_only || false,
    is_public:                 draft.is_public === true,
    visibility_mode:           draft.visibility_mode || 'secret',
    // LIRI — Notifications
    notify_dashboard:          draft.notify_dashboard !== false,
    notify_email:              draft.notify_email || false,
    notify_whatsapp:           draft.notify_whatsapp === true,
    reminder_before_minutes:   draft.reminder_before_minutes || 15,
    // LIRI — Invitations (objets complets pour audit)
    invited_users:             draft.invited_users || [],
    invited_classes:           draft.invited_classes || [],
    invited_modules:           draft.invited_modules || [],
    invited_roles:             draft.invited_roles || [],
    moderators:                draft.moderators || [],
    allow_members_invite:      draft.allow_members_invite || false,
    // Interactions & IA
    ai_summary_enabled:        draft.ai_summary_enabled,
    ai_mindmap_enabled:        draft.ai_mindmap_enabled,
    quiz_enabled:              draft.quiz_enabled,
    polls_enabled:             draft.polls_enabled,
    neuronq_enabled:           draft.neuronq_enabled,
    neuro_recall_enabled:      draft.neuro_recall_enabled,
    ambient_audio_enabled:     draft.ambient_audio_enabled,
    ambient_tracks:            Array.isArray(draft.ambient_tracks) ? draft.ambient_tracks : [],
    ambient_tracks_json:       draft.ambient_tracks?.length ? JSON.stringify(draft.ambient_tracks) : null,
    ...buildLiriAudioConfigPatch(
      draft.liri_audio_enabled === true,
      Array.isArray(draft.liri_audio_scenes) ? draft.liri_audio_scenes : [],
    ),
    // SmartBoard
    smartboard_scenes:         draft.smartboard_scenes,
    smartboard_slides:         draft.smartboard_slides,
    smartboard_shared_images:  draft.smartboard_shared_images,
    smartboard_shared_images_loop: draft.smartboard_shared_images_loop === true,
    smartboard_default_browser_url: draft.smartboard_default_browser_url,
    smartboard_shop_products:  draft.smartboard_shop_products,
    smartboard_element_scenes: Array.isArray(draft.smartboard_element_scenes) ? draft.smartboard_element_scenes : [],
    smartboard_master_script_sections: Array.isArray(draft.smartboard_master_script_sections) ? draft.smartboard_master_script_sections : [],
  };
}

export function Step8Validation({ draft, updateDraft, onSubmit, creating, user, clearDraft }) {
  const { toast } = useToast();
  const scheduledAt = draft.scheduled_at && isValid(new Date(draft.scheduled_at))
    ? format(new Date(draft.scheduled_at), "EEEE d MMMM 'à' HH:mm", { locale: fr })
    : '—';

  const handleSaveDraft = async () => {
    toast({ title: 'Brouillon enregistré', description: 'Vos modifications sont sauvegardées localement.' });
  };

  const handleSchedule = async () => {
    if (!draft.title?.trim()) {
      toast({ title: 'Titre requis', description: 'Donnez un titre à votre live.', variant: 'destructive' });
      return;
    }
    const scheduledAt = scheduledAtIsoFromDraft(draft);
    const payload = {
      title:               draft.title.trim(),
      description:         draft.description,
      session_type:        draft.session_type || 'classe',
      scheduled_at:        scheduledAt,
      visibility_mode:     draft.visibility_mode || 'secret',
      is_public:           draft.is_public === true,
      start_immediately:   false,
      cover_image_url:     draft.cover_image_url,
      duration_minutes:    draft.duration_minutes,
      // LIRI — Invitations
      invited_user_ids:    (draft.invited_users || []).map((u) => (typeof u === 'object' ? u.id : u)),
      invited_users:       draft.invited_users || [],
      invited_classes:     draft.invited_classes || [],
      invited_modules:     draft.invited_modules || [],
      invited_roles:       draft.invited_roles || [],
      allow_members_invite: draft.allow_members_invite,
      invited_by:          user?.id,
      // LIRI — Sécurité & Salle d'attente
      access_mode:         draft.access_mode || 'free',
      password:            draft.password || '',
      waiting_room:        draft.waiting_room !== false,
      waiting_room_audio_enabled:   draft.waiting_room_audio_enabled || false,
      waiting_room_show_plan:       draft.waiting_room_show_plan || false,
      waiting_room_show_details:    draft.waiting_room_show_details !== false,
      waiting_room_welcome_message: draft.waiting_room_welcome_message || '',
      // LIRI — Notifications
      notify_dashboard:    draft.notify_dashboard !== false,
      notify_email:        draft.notify_email || false,
      notify_whatsapp:     draft.notify_whatsapp === true,
      // Config complète
      config: buildConfig(draft),
    };
    await onSubmit(payload);
  };

  const handleLaunch = async () => {
    if (!draft.title?.trim()) {
      toast({ title: 'Titre requis', description: 'Donnez un titre à votre live.', variant: 'destructive' });
      return;
    }
    const payload = {
      title:               draft.title.trim(),
      description:         draft.description,
      session_type:        draft.session_type || 'classe',
      scheduled_at:        new Date().toISOString(),
      visibility_mode:     draft.visibility_mode || 'secret',
      is_public:           draft.is_public === true,
      start_immediately:   true,
      cover_image_url:     draft.cover_image_url,
      duration_minutes:    draft.duration_minutes,
      // LIRI — Invitations
      invited_user_ids:    (draft.invited_users || []).map((u) => (typeof u === 'object' ? u.id : u)),
      invited_users:       draft.invited_users || [],
      invited_classes:     draft.invited_classes || [],
      invited_modules:     draft.invited_modules || [],
      invited_roles:       draft.invited_roles || [],
      allow_members_invite: draft.allow_members_invite,
      invited_by:          user?.id,
      // LIRI — Sécurité & Salle d'attente
      access_mode:         draft.access_mode || 'free',
      password:            draft.password || '',
      waiting_room:        draft.waiting_room !== false,
      waiting_room_audio_enabled:   draft.waiting_room_audio_enabled || false,
      waiting_room_show_plan:       draft.waiting_room_show_plan || false,
      waiting_room_show_details:    draft.waiting_room_show_details !== false,
      waiting_room_welcome_message: draft.waiting_room_welcome_message || '',
      // LIRI — Notifications
      notify_dashboard:    draft.notify_dashboard !== false,
      notify_email:        draft.notify_email || false,
      notify_whatsapp:     draft.notify_whatsapp === true,
      // Config complète
      config: buildConfig(draft),
    };
    await onSubmit(payload);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-1">Validation finale</h2>
        <p className="text-gray-400">Vérifiez et lancez votre session.</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/10 bg-[#0F1419]/50 p-6 space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs text-gray-500">Titre</p>
            <p className="text-sm text-white font-medium mt-1">{draft.title || '—'}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs text-gray-500">Type</p>
            <p className="text-sm text-[#7B61FF] mt-1">{SESSION_TYPES[draft.session_type] || draft.session_type}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs text-gray-500">Date</p>
            <p className="text-sm text-white mt-1">{scheduledAt}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs text-gray-500">Durée</p>
            <p className="text-sm text-white mt-1">{draft.duration_minutes || 60} min</p>
          </div>
          {draft.liri_audio_enabled && (draft.liri_audio_scenes || []).filter((s) => String(s?.name || '').trim()).length > 0 ? (
            <div className="rounded-xl border border-[#7B61FF]/25 bg-[#7B61FF]/5 p-3 md:col-span-2">
              <p className="text-xs text-gray-500">Scènes audio LIRI</p>
              <p className="text-sm text-[#c4b5fd] mt-1">
                {(draft.liri_audio_scenes || []).filter((s) => String(s?.name || '').trim()).length} scène(s) — panneau dans l&apos;Arène
              </p>
            </div>
          ) : null}
        </div>
        <div className="rounded-xl border border-[#7B61FF]/20 bg-[#7B61FF]/5 p-3 space-y-2">
          <p className="text-xs text-[#7B61FF] font-medium">Invitations &amp; Accès (LIRI)</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-white/40">Mode d'accès</p>
              <p className="text-xs text-white font-medium capitalize">
                {draft.access_mode === 'free'     ? 'Libre'
                  : draft.access_mode === 'password' ? 'Mot de passe'
                  : draft.access_mode === 'manual'   ? 'Validation hôte'
                  : draft.access_mode === 'double'   ? 'Double validation'
                  : 'Libre'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-white/40">Salle d'attente</p>
              <p className="text-xs text-white font-medium">
                {draft.waiting_room !== false ? 'Activée' : 'Désactivée'}
                {draft.waiting_room_audio_enabled && ' · Audio activé'}
              </p>
            </div>
            {(draft.invited_users || []).length > 0 && (
              <div>
                <p className="text-[10px] text-white/40">Invitations individuelles</p>
                <p className="text-xs text-white font-medium">{draft.invited_users.length} personne(s)</p>
              </div>
            )}
            {(draft.invited_classes || []).length > 0 && (
              <div>
                <p className="text-[10px] text-white/40">Classes invitées</p>
                <p className="text-xs text-white font-medium">{draft.invited_classes.map((c) => c.name || c).join(', ')}</p>
              </div>
            )}
            {(draft.invited_modules || []).length > 0 && (
              <div>
                <p className="text-[10px] text-white/40">Modules invités</p>
                <p className="text-xs text-white font-medium">{draft.invited_modules.map((m) => m.name || m).join(', ')}</p>
              </div>
            )}
            {(draft.invited_roles || []).length > 0 && (
              <div>
                <p className="text-[10px] text-white/40">Rôles invités</p>
                <p className="text-xs text-white font-medium capitalize">{draft.invited_roles.join(', ')}</p>
              </div>
            )}
            {draft.notify_dashboard !== false && (
              <div>
                <p className="text-[10px] text-white/40">Notifications</p>
                <p className="text-xs text-white font-medium">
                  {[
                    draft.notify_dashboard !== false && 'Dashboard',
                    draft.notify_email && 'Email',
                    draft.notify_whatsapp && 'WhatsApp',
                  ].filter(Boolean).join(' + ') || '—'}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs text-gray-500">Outils IA</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {draft.neuronq_enabled && <span className="text-[10px] bg-[#7B61FF]/10 text-[#7B61FF] px-2 py-0.5 rounded-full">Neuron-Q</span>}
              {draft.neuro_recall_enabled && <span className="text-[10px] bg-[#7B61FF]/10 text-[#7B61FF] px-2 py-0.5 rounded-full">NeuroRecall</span>}
              {draft.quiz_enabled && <span className="text-[10px] bg-[#7B61FF]/10 text-[#7B61FF] px-2 py-0.5 rounded-full">Quiz</span>}
              {draft.polls_enabled && <span className="text-[10px] bg-[#7B61FF]/10 text-[#7B61FF] px-2 py-0.5 rounded-full">Sondages</span>}
              {draft.ai_summary_enabled && <span className="text-[10px] bg-[#7B61FF]/10 text-[#7B61FF] px-2 py-0.5 rounded-full">Résumé IA</span>}
              {draft.ai_mindmap_enabled && <span className="text-[10px] bg-[#7B61FF]/10 text-[#7B61FF] px-2 py-0.5 rounded-full">Mindmap</span>}
              {!draft.neuronq_enabled && !draft.neuro_recall_enabled && !draft.quiz_enabled && !draft.polls_enabled && !draft.ai_summary_enabled && !draft.ai_mindmap_enabled && (
                <span className="text-[10px] text-gray-600">Aucun</span>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs text-gray-500">Scènes SmartBoard</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {Object.entries(draft.smartboard_scenes || {}).filter(([, v]) => v !== false).map(([k]) => (
                <span key={k} className="text-[10px] bg-white/10 text-white/70 px-2 py-0.5 rounded-full capitalize">{k}</span>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs text-gray-500">Ambiance</p>
            <p className="text-sm text-white mt-1">
              {draft.ambient_audio_enabled ? `${(draft.ambient_tracks || []).length} piste(s)` : 'Désactivée'}
            </p>
          </div>
        </div>
      </motion.div>

      <div
        id="studio-validation-actions"
        className="sticky bottom-0 z-10 -mx-1 mt-8 border-t border-[#7B61FF]/20 bg-[#0a0908]/95 px-1 py-4 backdrop-blur-md supports-[backdrop-filter]:bg-[#0a0908]/88"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          variant="outline"
          onClick={handleSaveDraft}
          className="border-white/10 text-gray-300 hover:bg-white/5"
        >
          <Save className="w-4 h-4 mr-2" /> Enregistrer brouillon
        </Button>
        {typeof clearDraft === 'function' && (
          <Button
            variant="outline"
            onClick={clearDraft}
            className="border-white/10 text-gray-300 hover:bg-white/5"
          >
            Réinitialiser
          </Button>
        )}
        <Button
          onClick={handleSchedule}
          disabled={creating}
          className="bg-white/10 text-white hover:bg-white/20"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Calendar className="w-4 h-4 mr-2" />}
          Programmer
        </Button>
        <Button
          variant="accent"
          onClick={handleLaunch}
          disabled={creating}
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
          Lancer maintenant
        </Button>
        </div>
      </div>
    </div>
  );
}
