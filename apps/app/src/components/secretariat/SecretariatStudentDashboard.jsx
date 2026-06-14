import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSecretariatWorkflow } from '@/hooks/useSecretariatWorkflow';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, CreditCard, Clock, RefreshCw, UserPlus, BookOpen, GraduationCap, MessageSquare, Loader2, ChevronRight, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const PIPELINE_LABELS = {
  nouveau: 'Nouveau',
  inscription_creee: 'Inscription créée',
  paiement_attente: 'Paiement en attente',
  paiement_valide: 'Paiement validé',
  actif: 'Actif',
  risque: 'Risque',
  intervention: 'Intervention',
  renouvellement: 'Renouvellement',
};

const STATUS_LABELS = {
  actif: 'Actif',
  inactif: 'Inactif',
  absent: 'Absent',
  en_retard: 'En retard',
  expire: 'Expiré',
};

const STATUS_COLORS = {
  actif: 'bg-emerald-500/20 text-emerald-400',
  inactif: 'bg-gray-500/20 text-gray-400',
  absent: 'bg-amber-500/20 text-amber-400',
  en_retard: 'bg-orange-500/20 text-orange-400',
  expire: 'bg-red-500/20 text-red-400',
};

const SectionCard = ({
  title,
  icon: Icon,
  items,
  emptyMessage,
  onAction,
  actionLabel,
  canActivate = () => true,
  onActions,
  color = 'text-[var(--school-accent)]',
  gradient = 'from-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] to-amber-500/5',
  index = 0,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: index * 0.05 }}
    className="relative rounded-2xl overflow-hidden border bg-gradient-to-br from-[#192734] to-[#151a21] border-white/10 backdrop-blur-sm"
  >
    <div className="absolute inset-0 bg-[#151a21]/90" />
    <CardHeader className="relative pb-2 pt-5 px-5">
      <CardTitle className="text-white flex items-center gap-2 text-base">
        <motion.div
          className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${gradient} border border-white/10`}
          whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(212,175,55,0.2)' }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          <Icon className={`w-5 h-5 ${color}`} />
        </motion.div>
        {title}
        {items.length > 0 && <Badge className="ml-auto bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]">{items.length}</Badge>}
      </CardTitle>
    </CardHeader>
    <CardContent className="relative pt-0 px-5 pb-5">
      {items.length === 0 ? (
        <p className="text-gray-500 text-sm py-6">{emptyMessage}</p>
      ) : (
        <div className="space-y-2 max-h-[min(220px,40dvh)] sm:max-h-[280px] overflow-y-auto">
          {items.slice(0, 8).map((item, i) => {
            const showAction = onAction && canActivate(item);
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                whileHover={{ scale: 1.01, borderColor: 'rgba(212,175,55,0.3)' }}
                whileTap={{ scale: 0.99 }}
                className="p-3 rounded-xl border border-white/10 bg-white/5 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                onClick={() => onActions?.(item)}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-white font-medium truncate">{item.studentName}</p>
                  <p className="text-gray-400 text-xs truncate">{item.formationTitle}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] border-white/20">
                      {PIPELINE_LABELS[item.pipelineStage] || item.pipelineStage}
                    </Badge>
                    <Badge className={`text-[10px] ${STATUS_COLORS[item.dynamicStatus] || ''}`}>
                      {STATUS_LABELS[item.dynamicStatus] || item.dynamicStatus}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {showAction && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]"
                      onClick={(e) => { e.stopPropagation(); onAction(item); }}
                    >
                      {actionLabel || 'Voir'}
                    </Button>
                  )}
                  {onActions && (
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400"
                      onClick={(e) => { e.stopPropagation(); onActions(item); }}
                      title="Actions"
                    >
                      <ChevronRight className="w-4 h-4 -rotate-90" />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </CardContent>
  </motion.div>
);

const SecretariatStudentDashboard = () => {
  const { sections, alerts, stats, loading, refresh } = useSecretariatWorkflow();
  const { supabase, session } = useAuth();
  const { toast } = useToast();
  const [actionLoading, setActionLoading] = useState({});
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [actionsModalOpen, setActionsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [createForm, setCreateForm] = useState({ email: '', name: '' });
  const [createLoading, setCreateLoading] = useState(false);
  const [formations, setFormations] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [assignFormationId, setAssignFormationId] = useState('');
  const [assignTeacherId, setAssignTeacherId] = useState('');
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    const load = async () => {
      const [fRes, tRes] = await Promise.all([
        supabase.from('courses').select('id,title').eq('status', 'published'),
        supabase.from('profiles').select('id,name').eq('role', 'teacher'),
      ]);
      setFormations(fRes.data || []);
      setTeachers(tRes.data || []);
    };
    load();
  }, [supabase]);

  const callSecretariatAction = async (endpoint, payload) => {
    const token = session?.access_token;
    if (!token) throw new Error('Session expirée.');
    const res = await fetch(`/.netlify/functions/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Action impossible');
    return data;
  };

  const handleRelancePaiement = async (item) => {
    const key = `relance-${item.billing?.id}`;
    setActionLoading((p) => ({ ...p, [key]: true }));
    try {
      await callSecretariatAction('secretariat-mark-billing-followup', { subscriptionId: item.billing?.id });
      toast({ title: 'Relance enregistrée', description: `Suivi facturation pour ${item.studentName}` });
      refresh();
    } catch (err) {
      toast({ title: 'Erreur', description: err?.message, variant: 'destructive' });
    } finally {
      setActionLoading((p) => ({ ...p, [key]: false }));
    }
  };

  const handleTraiterInscription = async (item) => {
    const key = `traiter-${item.id}`;
    setActionLoading((p) => ({ ...p, [key]: true }));
    try {
      await callSecretariatAction('secretariat-process-enrollment', { enrollmentId: item.id, nextStatus: 'active' });
      toast({ title: 'Inscription traitée', description: `${item.studentName} est maintenant actif` });
      refresh();
    } catch (err) {
      toast({ title: 'Erreur', description: err?.message, variant: 'destructive' });
    } finally {
      setActionLoading((p) => ({ ...p, [key]: false }));
    }
  };

  const openActionsModal = (item) => {
    setSelectedStudent(item);
    setAssignFormationId(item.formation_id || '');
    setAssignTeacherId(item.assigned_teacher_id || '');
    setMessageText('');
    setActionsModalOpen(true);
  };

  const handleCreateStudent = async (e) => {
    e?.preventDefault();
    if (!createForm.email?.trim() || !createForm.name?.trim()) {
      toast({ title: 'Champs requis', description: 'Email et nom obligatoires', variant: 'destructive' });
      return;
    }
    setCreateLoading(true);
    try {
      await callSecretariatAction('secretariat-invite-student', { email: createForm.email.trim(), name: createForm.name.trim() });
      toast({ title: 'Invitation envoyée', description: `${createForm.email} recevra un email d'invitation` });
      setCreateForm({ email: '', name: '' });
      setCreateModalOpen(false);
      refresh();
    } catch (err) {
      toast({ title: 'Erreur', description: err?.message, variant: 'destructive' });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleAssignFormation = async () => {
    if (!selectedStudent?.student_id || !assignFormationId) {
      toast({ title: 'Sélection requise', description: 'Choisissez une formation', variant: 'destructive' });
      return;
    }
    const key = 'assign-formation';
    setActionLoading((p) => ({ ...p, [key]: true }));
    try {
      const { error } = await supabase.from('student_progress').insert({
        user_id: selectedStudent.student_id,
        course_id: assignFormationId,
        status: 'pending',
      });
      if (error) throw error;
      toast({ title: 'Formation assignée', description: `${selectedStudent.studentName} inscrit` });
      setActionsModalOpen(false);
      refresh();
    } catch (err) {
      toast({ title: 'Erreur', description: err?.message, variant: 'destructive' });
    } finally {
      setActionLoading((p) => ({ ...p, [key]: false }));
    }
  };

  const handleAssignTeacher = async () => {
    if (!selectedStudent?.student_id || !assignTeacherId || !selectedStudent.formation_id) {
      toast({ title: 'Sélection requise', description: 'Élève, formation et professeur requis', variant: 'destructive' });
      return;
    }
    const key = 'assign-teacher';
    setActionLoading((p) => ({ ...p, [key]: true }));
    try {
      await callSecretariatAction('secretariat-assign-teacher', {
        studentId: selectedStudent.student_id,
        teacherId: assignTeacherId,
        formationId: selectedStudent.formation_id,
      });
      toast({ title: 'Professeur assigné', description: `${selectedStudent.studentName}` });
      setActionsModalOpen(false);
      refresh();
    } catch (err) {
      toast({ title: 'Erreur', description: err?.message, variant: 'destructive' });
    } finally {
      setActionLoading((p) => ({ ...p, [key]: false }));
    }
  };

  const handleSendMessage = async () => {
    if (!selectedStudent?.student_id || !messageText?.trim()) {
      toast({ title: 'Message requis', description: 'Saisissez un message', variant: 'destructive' });
      return;
    }
    const key = 'send-message';
    setActionLoading((p) => ({ ...p, [key]: true }));
    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: selectedStudent.student_id,
        title: 'Message du secrétariat',
        message: messageText.trim(),
        type: 'message',
      });
      if (error) throw error;
      toast({ title: 'Message envoyé', description: `À ${selectedStudent.studentName}` });
      setMessageText('');
      setActionsModalOpen(false);
      refresh();
    } catch (err) {
      toast({ title: 'Erreur', description: err?.message, variant: 'destructive' });
    } finally {
      setActionLoading((p) => ({ ...p, [key]: false }));
    }
  };

  return (
    <div className="relative min-h-[60vh]">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[250px] h-[250px] bg-indigo-500/5 rounded-full blur-[80px]" />
      </div>

      <div className="space-y-6 relative">
      {/* Header + Actions */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
      >
        <div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-3"
          >
            <Sparkles className="w-4 h-4 text-[var(--school-accent)]" />
            <span className="text-xs text-gray-400">Pipeline élève</span>
          </motion.div>
          <h2 className="text-2xl md:text-3xl font-serif font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
            Gestion des élèves
          </h2>
          <p className="text-gray-400 text-sm mt-1">Inscription → Paiement → Actif → Renouvellement</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="border-white/10 text-white backdrop-blur-sm">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </motion.div>
          <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
            <DialogTrigger asChild>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button size="sm" className="bg-[var(--school-accent)] text-black hover:bg-amber-500 shadow-lg shadow-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Créer élève
                </Button>
              </motion.div>
            </DialogTrigger>
            <DialogContent className="bg-[#192734] border-white/10 text-white max-w-md max-h-[min(90dvh,640px)] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Créer un élève</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateStudent} className="space-y-4">
                <div>
                  <Label className="text-gray-300">Email</Label>
                  <Input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="eleve@exemple.com"
                    className="bg-[#0F1419] border-white/10 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Nom</Label>
                  <Input
                    value={createForm.name}
                    onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Prénom Nom"
                    className="bg-[#0F1419] border-white/10 text-white mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={createLoading} className="bg-[var(--school-accent)] text-black hover:bg-amber-500">
                    {createLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Inviter'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)} className="border-white/10">
                    Annuler
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={actionsModalOpen} onOpenChange={setActionsModalOpen}>
            <DialogContent className="bg-[#192734] border-white/10 text-white max-w-lg max-h-[min(90dvh,720px)] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Actions — {selectedStudent?.studentName}</DialogTitle>
              </DialogHeader>
              {selectedStudent && (
                <div className="space-y-6">
                  <div>
                    <Label className="text-gray-300 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" /> Assigner une formation
                    </Label>
                    <Select value={assignFormationId} onValueChange={setAssignFormationId}>
                      <SelectTrigger className="bg-[#0F1419] border-white/10 text-white mt-2">
                        <SelectValue placeholder="Choisir une formation" />
                      </SelectTrigger>
                      <SelectContent>
                        {formations.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="mt-2 bg-[var(--school-accent)] text-black"
                      onClick={handleAssignFormation}
                      disabled={actionLoading['assign-formation'] || !assignFormationId}
                    >
                      {actionLoading['assign-formation'] ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assigner'}
                    </Button>
                  </div>
                  <div>
                    <Label className="text-gray-300 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" /> Assigner un professeur
                    </Label>
                    <Select value={assignTeacherId} onValueChange={setAssignTeacherId}>
                      <SelectTrigger className="bg-[#0F1419] border-white/10 text-white mt-2">
                        <SelectValue placeholder="Choisir un professeur" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name || t.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="mt-2 bg-[var(--school-accent)] text-black"
                      onClick={handleAssignTeacher}
                      disabled={actionLoading['assign-teacher'] || !assignTeacherId || !selectedStudent.formation_id}
                    >
                      {actionLoading['assign-teacher'] ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assigner'}
                    </Button>
                  </div>
                  <div>
                    <Label className="text-gray-300 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" /> Envoyer un message
                    </Label>
                    <Input
                      placeholder="Votre message..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      className="bg-[#0F1419] border-white/10 text-white mt-2"
                    />
                    <Button
                      size="sm"
                      className="mt-2 bg-[var(--school-accent)] text-black"
                      onClick={handleSendMessage}
                      disabled={actionLoading['send-message'] || !messageText?.trim()}
                    >
                      {actionLoading['send-message'] ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Envoyer'}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {[
          { label: 'Total élèves', value: stats.total, color: 'text-white', gradient: 'from-white/10 to-white/5' },
          { label: 'Actifs', value: stats.actifs, color: 'text-emerald-400', gradient: 'from-emerald-500/20 to-emerald-500/5' },
          { label: 'À traiter', value: stats.aTraiter, color: 'text-amber-400', gradient: 'from-amber-500/20 to-amber-500/5' },
          { label: 'Alertes', value: alerts.length, color: 'text-red-400', gradient: 'from-red-500/20 to-red-500/5' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 + i * 0.05 }}
            whileHover={{ scale: 1.02, y: -2 }}
            className="rounded-2xl overflow-hidden border border-white/10 bg-[#151a21]/80 backdrop-blur-xl"
          >
            <CardContent className="p-5">
              <p className="text-gray-400 text-xs uppercase tracking-wider">{stat.label}</p>
              <p className={`text-2xl font-bold mt-2 ${stat.color}`}>{loading ? '—' : stat.value}</p>
            </CardContent>
          </motion.div>
        ))}
      </motion.div>

      {/* Alertes */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl overflow-hidden border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent backdrop-blur-sm"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center"
                >
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </motion.div>
                Alertes actives
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {alerts.slice(0, 10).map((a, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ x: 4 }}
                    className={`p-3 rounded-xl border ${
                      a.severity === 'urgent' ? 'border-red-500/40 bg-red-500/10' : 'border-amber-500/20 bg-amber-500/5'
                    }`}
                  >
                    <p className="text-white text-sm font-medium">{a.message || a.alert_type}</p>
                    <p className="text-gray-400 text-xs mt-1">
                      {a.item?.studentName} • {a.item?.formationTitle}
                    </p>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sections */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <SectionCard
          title="Nouveaux inscrits"
          icon={UserPlus}
          items={sections.nouveaux}
          emptyMessage="Aucun nouvel inscrit"
          onAction={handleTraiterInscription}
          actionLabel="Traiter"
          canActivate={(item) => item.pipelineStage === 'inscription_creee'}
          onActions={openActionsModal}
          gradient="from-emerald-500/20 to-cyan-500/10"
          index={0}
        />
        <SectionCard
          title="Urgences"
          icon={AlertTriangle}
          items={sections.urgences}
          emptyMessage="Aucune urgence"
          color="text-red-400"
          onActions={openActionsModal}
          gradient="from-red-500/20 to-rose-500/10"
          index={1}
        />
        <SectionCard
          title="Paiements à suivre"
          icon={CreditCard}
          items={sections.paiements}
          emptyMessage="Aucun paiement en attente"
          onAction={handleRelancePaiement}
          actionLabel="Relancer"
          canActivate={(item) => !!item.billing?.id}
          onActions={openActionsModal}
          gradient="from-amber-500/20 to-yellow-500/10"
          index={2}
        />
        <SectionCard
          title="Absences"
          icon={Clock}
          items={sections.absences}
          emptyMessage="Aucune absence répétée"
          color="text-amber-400"
          onActions={openActionsModal}
          gradient="from-orange-500/20 to-amber-500/10"
          index={3}
        />
        <SectionCard
          title="Renouvellements"
          icon={RefreshCw}
          items={sections.renouvellements}
          emptyMessage="Aucun renouvellement à prévoir"
          color="text-cyan-400"
          onActions={openActionsModal}
          gradient="from-cyan-500/20 to-blue-500/10"
          index={4}
        />
      </motion.div>
      </div>
    </div>
  );
};

export default SecretariatStudentDashboard;
