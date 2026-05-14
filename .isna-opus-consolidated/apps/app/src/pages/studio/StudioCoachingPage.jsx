import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStudioDraft } from '@/hooks/useStudioDraft';
import { CoachingStudioBuilder } from '@/components/studio/builders/CoachingStudioBuilder';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const STORAGE_KEY = 'studio_coaching_draft';
const DEFAULT_DRAFT = {
  title: '',
  description: '',
  program_weeks: 6,
  sessions_per_week: 1,
  journal_enabled: true,
  goals_tracking: true,
  mentor_chat: false,
};

export default function StudioCoachingPage() {
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
      toast({ title: 'Titre requis', description: 'Donnez un titre au programme.', variant: 'destructive' });
      return;
    }

    const weeks = Math.max(1, Math.min(104, Number(draft.program_weeks) || 6));
    const perWeek = Math.max(1, Math.min(14, Number(draft.sessions_per_week) || 1));

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('coaching_programs')
        .insert({
          owner_id: user.id,
          title: draft.title.trim(),
          description: (draft.description || '').trim() || null,
          program_weeks: weeks,
          sessions_per_week: perWeek,
          journal_enabled: !!draft.journal_enabled,
          goals_tracking: !!draft.goals_tracking,
          mentor_chat: !!draft.mentor_chat,
          status: 'active',
        })
        .select('id')
        .single();

      if (error) throw error;

      toast({
        title: 'Programme créé',
        description: `"${draft.title}" est prêt à être assigné à des étudiants.`,
      });
      clearDraft();
      const target = location.pathname.startsWith('/studio') ? '/studio' : '/teacher-space/agenda';
      navigate(target, { state: { createdCoachingProgramId: data?.id } });
    } catch (e) {
      // If migration not yet applied in this environment, give a friendly hint.
      const msg = String(e?.message || e);
      const isMissingTable = /relation .* does not exist/i.test(msg) || /coaching_programs/i.test(msg);
      toast({
        title: 'Création impossible',
        description: isMissingTable
          ? "La table coaching_programs n'est pas encore déployée. Appliquez la migration 20260421_coaching_programs.sql."
          : msg,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <CoachingStudioBuilder
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
