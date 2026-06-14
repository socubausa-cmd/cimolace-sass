import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStudioDraft } from '@/hooks/useStudioDraft';
import { AppointmentStudioBuilder } from '@/components/studio-creator/studio/builders/AppointmentStudioBuilder';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const STORAGE_KEY = 'studio_appointment_draft';
const DEFAULT_DRAFT = {
  title: '',
  session_type: 'individuel',
  duration_minutes: 30,
  date: '',
  time_range: '',
  confirmation_email: true,
  allow_reschedule: false,
  waitlist_enabled: false,
};

// Parse "HH:MM-HH:MM" into a start ISO string combined with a date (YYYY-MM-DD).
function buildScheduledAt(date, timeRange) {
  if (!date) return null;
  const [startTime] = String(timeRange || '')
    .split(/[-–—]/)
    .map((s) => s.trim());
  const [h, m] = (startTime || '09:00').split(':').map((n) => parseInt(n, 10) || 0);
  const iso = new Date(`${date}T00:00:00`);
  if (Number.isNaN(iso.getTime())) return null;
  iso.setHours(h, m, 0, 0);
  return iso.toISOString();
}

// Studio "session_type" (individuel/groupe/diagnostic) -> live_sessions "session_type" check-constraint
function mapToLiveSessionType(studioType) {
  // live_sessions CHECK: 'entretien' | 'classe' | 'conference'
  if (studioType === 'groupe') return 'classe';
  if (studioType === 'diagnostic') return 'entretien';
  return 'entretien';
}

export default function StudioAppointmentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const { draft, updateDraft, clearDraft, lastSavedAt, saveStatus, saveError } = useStudioDraft(
    STORAGE_KEY,
    DEFAULT_DRAFT,
    user?.id
  );

  const handleClose = () => {
    navigate(location.pathname.startsWith('/studio') ? '/studio' : '/teacher-space/agenda');
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      toast({ title: 'Non connecté', description: 'Veuillez vous reconnecter.', variant: 'destructive' });
      return;
    }
    if (!draft?.title?.trim()) {
      toast({ title: 'Titre requis', description: 'Donnez un titre à votre rendez-vous.', variant: 'destructive' });
      return;
    }
    const scheduledAt = buildScheduledAt(draft.date, draft.time_range);
    if (!scheduledAt) {
      toast({
        title: 'Date requise',
        description: 'Renseignez une date (et idéalement une plage horaire).',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('live_sessions')
        .insert({
          teacher_id: user.id,
          title: draft.title.trim(),
          session_type: mapToLiveSessionType(draft.session_type),
          scheduled_at: scheduledAt,
          visibility_mode: 'secret',
          status: 'scheduled',
        })
        .select('id')
        .single();

      if (error) throw error;

      toast({
        title: 'Rendez-vous créé',
        description: `"${draft.title}" a été ajouté à votre agenda.`,
      });
      clearDraft();
      const target = location.pathname.startsWith('/studio') ? '/studio' : '/teacher-space/agenda';
      navigate(target, { state: { createdLiveSessionId: data?.id } });
    } catch (e) {
      toast({
        title: 'Création impossible',
        description: String(e?.message || e),
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppointmentStudioBuilder
      draft={draft}
      updateDraft={updateDraft}
      lastSavedAt={lastSavedAt}
      saveStatus={saveStatus}
      saveError={saveError}
      onClose={handleClose}
      onSubmit={handleSubmit}
      creating={creating}
    />
  );
}
