import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTeacherAppointments } from '@/hooks/useTeacherAppointments';
import { useProfilesSearch } from '@/hooks/useProfilesSearch';
import { useLiveStudioDraft } from '@/hooks/useLiveStudioDraft';
import { LiveStudioBuilder } from '@/components/studio-creator/studio/builders/LiveStudioBuilder';
import { useToast } from '@/components/ui/use-toast';
import { pushWizardSmartboardToLiveScenes } from '@/lib/pushWizardSmartboardToLiveScenes';
import { formatJoinCodeDisplay } from '@/lib/liveJoinCode';

export default function LiveStudioPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const liriAgentImport = location.state?.liriAgentImport;
  const [searchParams] = useSearchParams();
  /** Import depuis l'Agent LIRI : ouvrir l'étape 6, sous-écran « Programme SmartBoard » (textarea Architect) */
  const liriWizardBootRef = useRef(null);
  if (liriWizardBootRef.current === null && searchParams.get('liriImport') === '1') {
    liriWizardBootRef.current = { stepId: 6, nestedIndex: 1 };
  }
  const { toast } = useToast();
  const isStaff = ['secretariat', 'admin', 'owner'].includes(String(user?.role || '').toLowerCase());
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState(user?.id || null);
  const { fetchTeachers } = useProfilesSearch();
  const { draft, updateDraft, clearDraft, lastSavedAt, saveStatus, saveError } = useLiveStudioDraft(user?.id, selectedTeacherId || user?.id);
  const { createLiveSession } = useTeacherAppointments(selectedTeacherId || user?.id);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isStaff) fetchTeachers().then(setTeachers);
  }, [isStaff, fetchTeachers]);

  useEffect(() => {
    if (!isStaff && user?.id) setSelectedTeacherId(user.id);
    else if (isStaff && teachers.length > 0 && !selectedTeacherId) setSelectedTeacherId(teachers[0]?.id);
  }, [isStaff, user?.id, teachers, selectedTeacherId]);

  useEffect(() => {
    if (searchParams.get('liriImport') === '1') {
      navigate('/studio/live', { replace: true });
    }
  }, [searchParams, navigate]);

  const handleSubmit = async (payload) => {
    if (!user?.id) {
      toast({ title: 'Session requise', description: 'Veuillez vous reconnecter.', variant: 'destructive' });
      return;
    }
    if (isStaff && !selectedTeacherId) {
      toast({ title: 'Enseignant requis', description: 'Sélectionnez un enseignant.', variant: 'destructive' });
      return;
    }
    setCreating(true);
    const fullPayload = {
      ...payload,
      teacher_id: isStaff ? selectedTeacherId : undefined,
    };
    const { error: err, sessionId, inviteEmailReport, join_code } = await createLiveSession(fullPayload);
    setCreating(false);
    if (err) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
      return;
    }
    if (inviteEmailReport?.requested) {
      if (inviteEmailReport.skipped_no_api_key) {
        toast({
          title: 'E-mails non envoyés',
          description:
            'L\'option « E-mail » était activée, mais RESEND_API_KEY n\'est pas définie sur Netlify. Définissez aussi RESEND_FROM avec un domaine vérifié chez Resend. Les invitations restent visibles sur le dashboard des invités.',
          variant: 'destructive',
        });
      } else if (
        inviteEmailReport.candidates > 0 &&
        inviteEmailReport.sent === 0 &&
        inviteEmailReport.skipped_no_email >= inviteEmailReport.candidates
      ) {
        toast({
          title: 'Aucun e-mail parti',
          description:
            'Aucune adresse utilisable (ni dans le profil, ni sur le compte Supabase Auth). Vérifiez que l\'invité s\'est inscrit avec un e-mail, activez « E-mail » à l\'étape Sécurité, et que RESEND_API_KEY / RESEND_FROM sont définis sur Netlify.',
          variant: 'destructive',
        });
      } else if (inviteEmailReport.failed > 0) {
        toast({
          title: 'E-mails partiellement envoyés',
          description: `${inviteEmailReport.sent} réussi(s), ${inviteEmailReport.failed} échec(s). Vérifiez Resend (quota, domaine expéditeur RESEND_FROM).`,
          variant: 'destructive',
        });
      } else if (inviteEmailReport.sent > 0) {
        toast({
          title: 'Invitations e-mail',
          description: `${inviteEmailReport.sent} e-mail(s) envoyé(s) via Resend.`,
        });
      }
    }
    const wizardScenes = fullPayload.config?.smartboard_element_scenes;
    if (sessionId && Array.isArray(wizardScenes) && wizardScenes.length > 0) {
      const push = await pushWizardSmartboardToLiveScenes(sessionId, wizardScenes, { skipIfScenesExist: true });
      if (!push.ok && push.reason === 'scenes_exist') {
        /* Déjà des scènes (rare à la création) — la config JSON suffit encore */
      } else if (!push.ok && push.error) {
        toast({
          title: 'Scènes SmartBoard',
          description: `Session créée, mais la copie en base a échoué : ${push.error.message}. Le programme reste dans la config du live.`,
          variant: 'destructive',
        });
      }
    }
    const joinHint =
      join_code &&
      `Code mobile LIRI : ${formatJoinCodeDisplay(join_code)} — partager pour rejoindre depuis l'app (écran « Rejoindre avec un code »).`;
    toast({
      title: payload.start_immediately ? 'Session lancée' : 'Session programmée',
      description: joinHint
        ? `${payload.start_immediately ? 'Redirection… ' : ''}${joinHint}`
        : payload.start_immediately
          ? 'Redirection…'
          : 'Votre live a été créé.',
    });
    clearDraft();
    if (payload.start_immediately && sessionId) {
      navigate(`/studio/live-arena/${sessionId}`);
    } else {
      navigate('/teacher-space/agenda');
    }
  };

  const handleClose = () => {
    navigate(location.pathname.startsWith('/studio') ? '/studio' : '/teacher-space/agenda');
  };

  return (
    <LiveStudioBuilder
      draft={draft}
      updateDraft={updateDraft}
      lastSavedAt={lastSavedAt}
      saveStatus={saveStatus}
      saveError={saveError}
      onClose={handleClose}
      onSubmit={handleSubmit}
      creating={creating}
      isStaff={isStaff}
      teachers={teachers}
      selectedTeacherId={selectedTeacherId}
      onTeacherChange={setSelectedTeacherId}
      user={user}
      initialNavigation={liriWizardBootRef.current || undefined}
      liriAgentImport={liriAgentImport}
    />
  );
}

