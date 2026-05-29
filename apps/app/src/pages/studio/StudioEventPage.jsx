import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStudioDraft } from '@/hooks/useStudioDraft';
import { EventStudioBuilder } from '@/components/studio/builders/EventStudioBuilder';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const STORAGE_KEY = 'studio_event_draft';
const DEFAULT_DRAFT = {
  title: '',
  description: '',
  date: '',
  duration_minutes: 60,
  location: '',
  registration_required: true,
  waiting_room: false,
  share_location: true,
};

function computeStartEnd(dateStr, durationMinutes) {
  if (!dateStr) return { start_at: null, end_at: null };
  // Date only → assume 09:00 local. Date-time accepted too.
  const start = dateStr.includes('T') ? new Date(dateStr) : new Date(`${dateStr}T09:00:00`);
  if (Number.isNaN(start.getTime())) return { start_at: null, end_at: null };
  const duration = Number(durationMinutes) > 0 ? Number(durationMinutes) : 60;
  const end = new Date(start.getTime() + duration * 60 * 1000);
  return { start_at: start.toISOString(), end_at: end.toISOString() };
}

export default function StudioEventPage() {
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
      toast({ title: 'Titre requis', description: "Donnez un titre à l'événement.", variant: 'destructive' });
      return;
    }
    const { start_at, end_at } = computeStartEnd(draft.date, draft.duration_minutes);
    if (!start_at) {
      toast({
        title: 'Date requise',
        description: "Choisissez une date pour l'événement.",
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('school_events')
        .insert({
          title: draft.title.trim(),
          description: (draft.description || '').trim() || null,
          start_at,
          end_at,
          location: draft.share_location ? (draft.location || null) : null,
          target_role: 'all',
          created_by: user.id,
        })
        .select('id')
        .single();

      if (error) throw error;

      toast({
        title: 'Événement créé',
        description: `"${draft.title}" est visible dans la vie scolaire.`,
      });
      clearDraft();
      const target = location.pathname.startsWith('/studio') ? '/studio' : '/teacher-space/agenda';
      navigate(target, { state: { createdEventId: data?.id } });
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
    <EventStudioBuilder
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
