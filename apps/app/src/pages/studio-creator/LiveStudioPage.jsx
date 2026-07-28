import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTeacherAppointments } from '@/hooks/useTeacherAppointments';
import { useProfilesSearch } from '@/hooks/useProfilesSearch';
import { useLiveStudioDraft } from '@/hooks/useLiveStudioDraft';
import { LiveStudioBuilder } from '@/components/studio-creator/studio/builders/LiveStudioBuilder';
import StudioDesignerLikeShell from '@/components/liri/liri-ecosystem/StudioDesignerLikeShell';
// Remap froid→chaud de tout le studio (le wizard /studio/live ne passe pas par StudioRouter
// qui posait le scope) : réchauffe stepper, champs, aperçu… conformément à la charte LIRI.
import '@/pages/studio-creator/studio/studioWarm.css';
import { Radio } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { pushWizardSmartboardToLiveScenes } from '@/lib/pushWizardSmartboardToLiveScenes';
import { formatJoinCodeDisplay } from '@/lib/liveJoinCode';
import { teleconsultApi } from '@/lib/api';
import { masterFactoryApi } from '@/lib/api-v2';

export default function LiveStudioPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const liriAgentImport = location.state?.liriAgentImport;
  const [searchParams] = useSearchParams();
  /** Import depuis l'Agent LIRI : ouvrir l'étape 6, sous-écran « Programme SmartBoard » (textarea Architect) */
  // « Lancer le live » (accès direct depuis MEDOS) : ouvre le wizard DIRECTEMENT à
  // l'étape 8 (Validation) → le praticien clique « Lancer maintenant » (1 clic).
  // « Préparer le live » = wizard normal depuis l'étape 1.
  const quickLaunch = searchParams.get('launch') === '1';
  const masterFactorySourceType = searchParams.get('mfSourceType');
  const masterFactorySourceId = searchParams.get('mfSourceId');
  // Live lancé depuis MEDOS (santé) → marque le live → cockpit clinique embarqué.
  const medosContext = searchParams.get('context') === 'medos';
  const liriWizardBootRef = useRef(null);
  if (liriWizardBootRef.current === null && searchParams.get('liriImport') === '1') {
    liriWizardBootRef.current = { stepId: 6, nestedIndex: 1 };
  }
  if (liriWizardBootRef.current === null && quickLaunch) {
    liriWizardBootRef.current = { stepId: 8 };
  }
  const { toast } = useToast();
  const isStaff = ['secretariat', 'admin', 'owner'].includes(String(user?.role || '').toLowerCase());
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState(user?.id || null);
  const { fetchTeachers } = useProfilesSearch();
  const { draft, updateDraft, clearDraft, lastSavedAt, saveStatus, saveError } = useLiveStudioDraft(user?.id, selectedTeacherId || user?.id);
  const { createLiveSession } = useTeacherAppointments(selectedTeacherId || user?.id);
  const [creating, setCreating] = useState(false);
  const [masterFactorySource, setMasterFactorySource] = useState(null);
  const [masterFactoryStatus, setMasterFactoryStatus] = useState(null);

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

  // Lancement direct : pré-remplit un titre (le champ Titre est requis pour lancer).
  useEffect(() => {
    if (quickLaunch && draft && !String(draft.title || '').trim()) {
      updateDraft({ title: `Live — ${new Date().toLocaleDateString('fr-FR')}` });
    }
  }, [quickLaunch, draft, updateDraft]);

  // Pont officiel Master Factory → Live Studio :
  // /studio/live?mfSourceType=replay&mfSourceId=<uuid> arme la publication du scénario
  // dans la session live créée par le wizard. On évite d'écraser un draft déjà armé.
  const masterFactoryPrefillRef = useRef(false);
  useEffect(() => {
    if (!draft || masterFactoryPrefillRef.current || !masterFactorySourceId) return;
    masterFactoryPrefillRef.current = true;
    updateDraft({
      master_factory_enabled: true,
      master_factory_source_type: masterFactorySourceType || draft.master_factory_source_type || 'replay',
      master_factory_source_id: masterFactorySourceId,
      master_factory_replace_existing: searchParams.get('mfReplace') === '1',
      master_factory_force: searchParams.get('mfForce') === '1',
    });
  }, [draft, masterFactorySourceId, masterFactorySourceType, searchParams, updateDraft]);

  useEffect(() => {
    if (!masterFactorySourceId) return;
    let alive = true;
    const sourceType = masterFactorySourceType || 'replay';
    const loadMasterFactoryContext = async () => {
      try {
        const [source, status] = await Promise.all([
          masterFactoryApi.getSource(sourceType, masterFactorySourceId).catch(() => null),
          masterFactoryApi.status(sourceType, masterFactorySourceId).catch(() => null),
        ]);
        if (!alive) return;
        const normalizedSource = source?.data || source || null;
        setMasterFactorySource(normalizedSource);
        setMasterFactoryStatus(status?.data || status || null);
        if (normalizedSource?.title) {
          const patch = {};
          if (!String(draft?.title || '').trim()) patch.title = `Live · ${normalizedSource.title}`;
          if (!String(draft?.description || '').trim()) {
            patch.description =
              `Session préparée depuis Master Factory : ${normalizedSource.title}. ` +
              'Le Master Script, le SmartBoard et le scénario live seront publiés à la création.';
          }
          if (!draft?.session_type || draft.session_type === 'teleconsult') patch.session_type = 'classe';
          if (!draft?.category || draft.category === 'teleconsultation') patch.category = 'formation';
          if (Object.keys(patch).length) updateDraft(patch);
        }
      } catch {
        if (alive) {
          setMasterFactorySource(null);
          setMasterFactoryStatus(null);
        }
      }
    };
    loadMasterFactoryContext();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterFactorySourceId, masterFactorySourceType]);

  // Pré-remplissage depuis MEDOS (bouton « Préparer » d'un RDV téléconsult) :
  // titre = patient, date/heure = RDV, mode santé (cockpit clinique) activé —
  // UNIQUEMENT si le brouillon est vierge (on n'écrase pas un draft en cours).
  const prefillRef = useRef(false);
  useEffect(() => {
    if (!draft || prefillRef.current) return;
    const t = searchParams.get('title');
    const d = searchParams.get('date');
    const tm = searchParams.get('time');
    const patch = {};
    if (t && !String(draft.title || '').trim()) patch.title = t;
    if (d && !draft.scheduled_at) patch.scheduled_at = d;
    if (tm && !draft.scheduled_time) patch.scheduled_time = tm;
    if (medosContext && draft.medos_mode !== true) patch.medos_mode = true;
    if (Object.keys(patch).length) {
      prefillRef.current = true;
      updateDraft(patch);
    }
  }, [draft, searchParams, medosContext, updateDraft]);

  const handleSubmit = async (payload) => {
    if (!user?.id) {
      toast({ title: 'Session requise', description: 'Veuillez vous reconnecter.', variant: 'destructive' });
      return;
    }
    // ⛔ MEDOS ≠ Formation. Depuis MEDOS (context=medos), lancer ouvre la salle
    // TÉLÉCONSULT (cockpit clinique + patient) du RDV — JAMAIS l'arène Formation.
    // On rejoint la session téléconsult du RDV (join par appointment) et on y va.
    if ((medosContext || draft?.medos_mode === true) && payload.start_immediately) {
      const apptId = searchParams.get('appointment');
      const patientId = draft?.medos_patient_id || '';
      if (!apptId && !patientId) {
        toast({
          title: 'Téléconsultation',
          description: 'Choisissez un patient à l’étape « Dossier MEDOS » ou lancez depuis un rendez-vous.',
          variant: 'destructive',
        });
        return;
      }
      setCreating(true);
      try {
        // Résout la session téléconsult : RDV existant (join, idempotent) OU patient
        // choisi dans l'étape Dossier MEDOS (création d'une session à la volée).
        const tc = apptId
          ? await teleconsultApi.joinByAppointment(apptId)
          : await teleconsultApi.create({ patient_id: patientId });
        const tcId = tc?.session_id || tc?.id;
        if (!tcId) throw new Error('Session téléconsultation invalide');
        // Pré-remplissage du cockpit (boutique + éléments cliniques préparés) : lu
        // par la salle au montage pour pré-cocher ce que le praticien a choisi ici.
        try {
          localStorage.setItem(`medos:prefill:${tcId}`, JSON.stringify({
            shopProductIds: Array.isArray(draft?.medos_shop_product_ids) ? draft.medos_shop_product_ids : [],
            share: draft?.medos_share || null,
            patientLabel: draft?.medos_patient_label || '',
          }));
        } catch { /* localStorage indispo : le praticien re-sélectionnera dans la salle */ }
        const slug = searchParams.get('tenant') || '';
        clearDraft();
        navigate(`/teleconsult/${tcId}${slug ? `?tenant=${encodeURIComponent(slug)}` : ''}`);
      } catch (e) {
        toast({ title: 'Téléconsultation', description: e?.message || "Impossible d'ouvrir la salle MEDOS.", variant: 'destructive' });
      } finally {
        setCreating(false);
      }
      return; // en mode MEDOS on ne crée JAMAIS de live Formation
    }
    if (isStaff && !selectedTeacherId) {
      toast({ title: 'Enseignant requis', description: 'Sélectionnez un enseignant.', variant: 'destructive' });
      return;
    }
    setCreating(true);
    const fullPayload = {
      ...payload,
      teacher_id: isStaff ? selectedTeacherId : undefined,
      // Live MEDOS (santé) : persiste le marqueur dans `config` (JSONB déjà sauvegardé)
      // → au runtime, le moteur live monte le cockpit clinique (jumeau 3D éducation).
      ...((medosContext || draft?.medos_mode === true)
        ? { config: { ...(payload.config || {}), production_live_type: 'medos' } }
        : {}),
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
    const masterFactoryConfig = fullPayload.config?.master_factory || {};
    const masterFactoryEnabled =
      masterFactoryConfig.enabled === true ||
      draft?.master_factory_enabled === true ||
      Boolean(masterFactoryConfig.source_id || draft?.master_factory_source_id || masterFactorySourceId);
    const sourceId =
      masterFactoryConfig.source_id ||
      draft?.master_factory_source_id ||
      masterFactorySourceId ||
      '';
    if (sessionId && masterFactoryEnabled && sourceId) {
      try {
        const published = await masterFactoryApi.publishLiveSession({
          sourceType:
            masterFactoryConfig.source_type ||
            draft?.master_factory_source_type ||
            masterFactorySourceType ||
            'replay',
          sourceId,
          liveSessionId: sessionId,
          replaceExisting:
            masterFactoryConfig.replace_existing === true ||
            draft?.master_factory_replace_existing === true ||
            searchParams.get('mfReplace') === '1',
          force:
            masterFactoryConfig.force === true ||
            draft?.master_factory_force === true ||
            searchParams.get('mfForce') === '1',
        });
        toast({
          title: 'Master Factory publié',
          description: `${published?.counts?.scenes ?? 0} scène(s) SmartBoard et ${published?.counts?.scriptSections ?? 0} section(s) de script prêtes dans le live.`,
        });
      } catch (e) {
        toast({
          title: 'Master Factory',
          description: `Live créé, mais la publication du scénario a échoué : ${e?.message || 'erreur inconnue'}.`,
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
    <div className="studio-warm-scope contents">
    <StudioDesignerLikeShell
      railActiveKey="live"
      pageLabel="Live"
      pageAccent="violet"
      TitleIcon={Radio}
      titleLine="Live Studio Créateur"
      hideRail
      hideEcosystemActions
    >
      {masterFactorySourceId ? (
        <div className="mb-4 rounded-2xl border border-[#e3b574]/35 bg-[#e3b574]/10 px-4 py-3 text-[#f5f4ee] shadow-[0_18px_48px_rgba(0,0,0,.22)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#e3b574]">Master Factory armé</p>
              <p className="mt-1 text-sm font-semibold">
                {masterFactorySource?.title || 'Source en cours de chargement…'}
              </p>
              <p className="mt-1 text-xs text-white/55">
                Source {masterFactorySourceType || 'replay'} · scénario live, Master Script et SmartBoard réutilisés à la création.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              {[
                ['Comprendre', masterFactoryStatus?.comprehension],
                ['Script', masterFactoryStatus?.master_script],
                ['Live', masterFactoryStatus?.live_scenario],
              ].map(([label, ok]) => (
                <span key={label} className={`rounded-xl border px-3 py-2 ${ok ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200' : 'border-white/10 bg-white/5 text-white/55'}`}>
                  {label}<br /><strong>{ok ? 'Prêt' : 'Lecture'}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}
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
        embedInShell
      />
    </StudioDesignerLikeShell>
    </div>
  );
}
