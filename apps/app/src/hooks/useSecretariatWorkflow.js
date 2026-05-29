import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

const isMissingRelationError = (error) => {
  const code = String(error?.code || '');
  const msg = String(error?.message || '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || msg.includes('does not exist') || msg.includes('could not find the table');
};

const PIPELINE_STAGES = [
  'nouveau',
  'inscription_creee',
  'paiement_attente',
  'paiement_valide',
  'actif',
  'risque',
  'intervention',
  'renouvellement',
];

const DYNAMIC_STATUSES = ['actif', 'inactif', 'absent', 'en_retard', 'expire'];

const PAYMENT_PENDING_DAYS = 7;
const ABSENCE_THRESHOLD = 3;
const INACTIVITY_DAYS = 14;
const RENEWAL_DAYS_BEFORE = 30;

function computePipelineStage(enrollment, billing, absencesCount, lastActivity) {
  const status = enrollment?.status || 'pending';
  const billingStatus = billing?.status || 'none';
  const now = new Date();
  const enrolledAt = new Date(enrollment?.enrolled_at || now);
  const expiresAt = billing?.expires_at ? new Date(billing.expires_at) : null;
  const daysSinceEnrollment = (now - enrolledAt) / (24 * 60 * 60 * 1000);
  const daysToExpiry = expiresAt ? (expiresAt - now) / (24 * 60 * 60 * 1000) : null;

  if (enrollment?.pipeline_stage) return enrollment.pipeline_stage;

  if (status === 'pending' && daysSinceEnrollment < 2) return 'nouveau';
  if (status === 'pending') return 'inscription_creee';
  if (['past_due', 'pending'].includes(billingStatus)) return 'paiement_attente';
  if (billingStatus === 'active' && status === 'active' && daysToExpiry !== null && daysToExpiry <= RENEWAL_DAYS_BEFORE) return 'renouvellement';
  if (absencesCount >= ABSENCE_THRESHOLD) return 'risque';
  if (lastActivity && (now - new Date(lastActivity)) / (24 * 60 * 60 * 1000) > INACTIVITY_DAYS) return 'risque';
  if (billingStatus === 'active' && status === 'active') return 'actif';
  if (billingStatus === 'expired') return 'intervention';
  return 'actif';
}

function computeDynamicStatus(enrollment, billing, absencesCount, lastActivity) {
  const billingStatus = billing?.status || 'none';
  const now = new Date();
  const expiresAt = billing?.expires_at ? new Date(billing.expires_at) : null;
  const daysToExpiry = expiresAt ? (expiresAt - now) / (24 * 60 * 60 * 1000) : null;

  if (billingStatus === 'expired' || (daysToExpiry !== null && daysToExpiry < 0)) return 'expire';
  if (absencesCount >= ABSENCE_THRESHOLD) return 'absent';
  if (lastActivity && (now - new Date(lastActivity)) / (24 * 60 * 60 * 1000) > INACTIVITY_DAYS) return 'inactif';
  if (billingStatus === 'active' && enrollment?.status === 'active') return 'actif';
  return 'actif';
}

export function useSecretariatWorkflow() {
  const { supabase } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sections, setSections] = useState({
    nouveaux: [],
    urgences: [],
    paiements: [],
    absences: [],
    renouvellements: [],
  });
  const [studentsWithPipeline, setStudentsWithPipeline] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    actifs: 0,
    aTraiter: 0,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Source : student_progress (not enrollments), courses (not formations)
      const [
        progressRes,
        billingRes,
        profilesRes,
        coursesRes,
        attendanceRes,
        alertsRes,
      ] = await Promise.all([
        supabase
          .from('student_progress')
          .select('id,user_id,course_id,status,created_at,completed_at')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('billing_subscriptions')
          .select('id,user_id,status,expires_at,created_at')
          .in('status', ['pending', 'active', 'past_due', 'expired']),
        supabase.from('profiles').select('id,name,email,role').in('role', ['student', 'visitor']),
        supabase.from('courses').select('id,title,status'),
        supabase.from('attendance_records').select('id,student_id,status,created_at').eq('status', 'absent'),
        supabase
          .from('secretariat_alerts')
          .select('id,alert_type,message,created_at,acknowledged_at')
          .is('acknowledged_at', null)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const rawProgress = isMissingRelationError(progressRes.error) ? [] : (progressRes.data || []);
      const billings = isMissingRelationError(billingRes.error) ? [] : (billingRes.data || []);
      const profiles = isMissingRelationError(profilesRes.error) ? [] : (profilesRes.data || []);
      const formations = isMissingRelationError(coursesRes.error) ? [] : (coursesRes.data || []);
      const attendance = isMissingRelationError(attendanceRes.error) ? [] : (attendanceRes.data || []);
      const dbAlerts = isMissingRelationError(alertsRes.error) ? [] : (alertsRes.data || []);

      // Deduplicate student_progress by (user_id, course_id) — one enrollment per course
      const seenPairs = new Set();
      const enrollments = rawProgress
        .filter((r) => {
          const key = `${r.user_id}-${r.course_id}`;
          if (seenPairs.has(key)) return false;
          seenPairs.add(key);
          return true;
        })
        .map((r) => ({
          id: r.id,
          student_id: r.user_id,
          formation_id: r.course_id,
          status: r.status === 'completed' ? 'active' : (r.status || 'active'),
          enrolled_at: r.created_at,
          pipeline_stage: null,
          last_activity_at: r.completed_at || r.created_at,
          assigned_teacher_id: null,
        }));

      const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
      const formationMap = Object.fromEntries(formations.map((f) => [f.id, f]));
      const billingByUser = Object.fromEntries(billings.map((b) => [b.user_id, b]));
      const absencesByStudent = attendance.reduce((acc, a) => {
        acc[a.student_id] = (acc[a.student_id] || 0) + 1;
        return acc;
      }, {});

      const now = new Date();
      const students = [];
      const nouveaux = [];
      const urgences = [];
      const paiements = [];
      const absences = [];
      const renouvellements = [];
      const computedAlerts = [];

      for (const enr of enrollments) {
        const student = profileMap[enr.student_id];
        const formation = formationMap[enr.formation_id];
        const billing = billingByUser[enr.student_id];
        const absCount = absencesByStudent[enr.student_id] || 0;
        const lastActivity = enr.last_activity_at || enr.enrolled_at;

        const pipelineStage = computePipelineStage(enr, billing, absCount, lastActivity);
        const dynamicStatus = computeDynamicStatus(enr, billing, absCount, lastActivity);

        const item = {
          ...enr,
          student,
          formation,
          billing,
          absencesCount: absCount,
          pipelineStage,
          dynamicStatus,
          studentName: student?.name || student?.email || 'Inconnu',
          formationTitle: formation?.title || 'Formation',
        };

        students.push(item);

        if (pipelineStage === 'nouveau' || pipelineStage === 'inscription_creee') nouveaux.push(item);
        if (pipelineStage === 'risque' || pipelineStage === 'intervention' || dynamicStatus === 'expire') urgences.push(item);
        if (pipelineStage === 'paiement_attente' || (billing?.status && ['past_due', 'pending'].includes(billing.status))) paiements.push(item);
        if (absCount >= ABSENCE_THRESHOLD) absences.push(item);
        if (pipelineStage === 'renouvellement') renouvellements.push(item);

        const expiresAt = billing?.expires_at ? new Date(billing.expires_at) : null;
        const daysToExpiry = expiresAt ? (expiresAt - now) / (24 * 60 * 60 * 1000) : null;
        const daysSinceEnrollment = (now - new Date(enr.enrolled_at)) / (24 * 60 * 60 * 1000);

        if (billing?.status === 'past_due' && daysSinceEnrollment > PAYMENT_PENDING_DAYS) {
          computedAlerts.push({ type: 'paiement_attente', severity: 'high', item, message: `Paiement en attente depuis ${Math.floor(daysSinceEnrollment)} jours` });
        }
        if (absCount >= ABSENCE_THRESHOLD) {
          computedAlerts.push({ type: 'absence_repetee', severity: 'medium', item, message: `${absCount} absences enregistrées` });
        }
        if (billing?.status === 'expired') {
          computedAlerts.push({ type: 'abonnement_expire', severity: 'urgent', item, message: 'Abonnement expiré' });
        }
        if (lastActivity && (now - new Date(lastActivity)) / (24 * 60 * 60 * 1000) > INACTIVITY_DAYS) {
          computedAlerts.push({ type: 'inactivite', severity: 'medium', item, message: 'Inactivité détectée' });
        }
        if (daysToExpiry !== null && daysToExpiry > 0 && daysToExpiry <= RENEWAL_DAYS_BEFORE) {
          computedAlerts.push({ type: 'renouvellement_proche', severity: 'low', item, message: `Renouvellement dans ${Math.floor(daysToExpiry)} jours` });
        }
      }

      setSections({ nouveaux, urgences, paiements, absences, renouvellements });
      setStudentsWithPipeline(students);
      setAlerts([...computedAlerts, ...dbAlerts.map((a) => ({ ...a, type: a.alert_type }))]);
      setStats({
        total: students.length,
        actifs: students.filter((s) => s.dynamicStatus === 'actif').length,
        aTraiter: urgences.length + paiements.length + nouveaux.filter((n) => n.pipelineStage === 'inscription_creee').length,
      });
    } catch (err) {
      setError(err);
      setSections({ nouveaux: [], urgences: [], paiements: [], absences: [], renouvellements: [] });
      setStudentsWithPipeline([]);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Mise à jour en temps réel
  useEffect(() => {
    const channels = [];
    const tableList = ['student_progress', 'billing_subscriptions', 'attendance_records', 'secretariat_alerts'];
    tableList.forEach((table) => {
      const ch = supabase
        .channel(`secretariat-workflow-${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => refresh())
        .subscribe();
      channels.push(ch);
    });
    return () => channels.forEach((ch) => supabase.removeChannel(ch));
  }, [supabase, refresh]);

  return {
    loading,
    error,
    sections,
    studentsWithPipeline,
    alerts,
    stats,
    refresh,
    PIPELINE_STAGES,
    DYNAMIC_STATUSES,
  };
}
