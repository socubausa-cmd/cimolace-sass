import React, { useState } from 'react';
import { AlertCircle, Clock, User, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

function mapRowToCard(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    createdAt: row.created_at,
    assignedTo: row.assigned_to_label?.trim() || '—',
    status: row.status === 'resolved' ? 'resolved' : 'in_progress',
    solutions: row.solution || '',
    nextSteps: row.next_steps || '',
  };
}

const ProblemsSection = ({ studentId, problems, loading, onRefresh }) => {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(null);
  const [saving, setSaving] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newAssignee, setNewAssignee] = useState('');

  const [closeSolution, setCloseSolution] = useState('');
  const [closeNext, setCloseNext] = useState('');

  const resetCreateForm = () => {
    setNewTitle('');
    setNewDescription('');
    setNewAssignee('');
  };

  const handleCreate = async () => {
    if (!studentId || !newTitle.trim()) {
      toast({ title: 'Titre requis', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id || null;
      const { error } = await supabase.from('student_reported_problems').insert({
        student_id: studentId,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        assigned_to_label: newAssignee.trim() || null,
        status: 'open',
        created_by: uid,
      });
      if (error) throw error;
      toast({ title: 'Signalement enregistré' });
      setCreateOpen(false);
      resetCreateForm();
      await onRefresh?.();
    } catch (e) {
      toast({
        title: 'Erreur',
        description: e?.message || 'Impossible d\'enregistrer.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const openCloseDialog = (prob) => {
    setCloseOpen({ id: prob.id });
    setCloseSolution(prob.solutions || '');
    setCloseNext(prob.nextSteps || '');
  };

  const handleCloseReport = async () => {
    if (!closeOpen?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('student_reported_problems')
        .update({
          status: 'resolved',
          solution: closeSolution.trim() || null,
          next_steps: closeNext.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', closeOpen.id);
      if (error) throw error;
      toast({ title: 'Signalement clôturé' });
      setCloseOpen(null);
      await onRefresh?.();
    } catch (e) {
      toast({
        title: 'Erreur',
        description: e?.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const list = (problems || []).map(mapRowToCard);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-white">Problèmes signalés</h3>
        <Button
          size="sm"
          className="bg-red-600 hover:bg-red-700"
          onClick={() => setCreateOpen(true)}
          disabled={!studentId}
        >
          Nouveau signalement
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((prob) => (
            <Card
              key={prob.id}
              className="bg-[#192734] border-white/10 hover:border-red-500/30 transition-colors"
            >
              <CardContent className="p-5">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="p-2 bg-red-500/10 rounded-full text-red-500 mt-1 shrink-0">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-white text-lg">{prob.title}</h4>
                      {prob.description ? (
                        <p className="text-sm text-gray-400 mt-1">{prob.description}</p>
                      ) : null}

                      <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 shrink-0" />
                          {isValid(new Date(prob.createdAt))
                            ? format(new Date(prob.createdAt), 'dd MMM yyyy', { locale: fr })
                            : '—'}
                        </span>
                        <span className="flex items-center gap-1 min-w-0">
                          <User className="w-3 h-3 shrink-0" />
                          Assigné à :{' '}
                          <span className="text-white truncate">{prob.assignedTo}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Badge
                      className={
                        prob.status === 'resolved'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-orange-500/20 text-orange-400'
                      }
                    >
                      {prob.status === 'resolved' ? 'Résolu' : 'En cours'}
                    </Badge>
                    {prob.status !== 'resolved' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-emerald-500/40 text-emerald-300"
                        disabled={saving}
                        onClick={() => openCloseDialog(prob)}
                      >
                        Clôturer
                      </Button>
                    ) : null}
                  </div>
                </div>

                {(prob.solutions || prob.nextSteps) && (
                  <div className="mt-4 pt-4 border-t border-white/5 bg-black/20 p-3 rounded text-sm">
                    {prob.solutions ? (
                      <p className="mb-1">
                        <strong className="text-green-400">Solution :</strong>{' '}
                        <span className="text-gray-300">{prob.solutions}</span>
                      </p>
                    ) : null}
                    {prob.nextSteps ? (
                      <p>
                        <strong className="text-blue-400">Prochaine étape :</strong>{' '}
                        <span className="text-gray-300">{prob.nextSteps}</span>
                      </p>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {list.length === 0 && (
            <div className="text-gray-500 text-center py-10">
              Aucun problème signalé. Utilisez « Nouveau signalement » pour en ajouter un.
            </div>
          )}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-[#192734] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau signalement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="pb-title">Titre</Label>
              <Input
                id="pb-title"
                className="bg-[#0F1419] border-white/10 mt-1"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex. Difficulté de rythme"
              />
            </div>
            <div>
              <Label htmlFor="pb-desc">Description</Label>
              <Textarea
                id="pb-desc"
                className="bg-[#0F1419] border-white/10 mt-1 min-h-[100px]"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Contexte, constat…"
              />
            </div>
            <div>
              <Label htmlFor="pb-assign">Assigné à (libellé)</Label>
              <Input
                id="pb-assign"
                className="bg-[#0F1419] border-white/10 mt-1"
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
                placeholder="Ex. Coach principal, Secrétariat…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button className="bg-[var(--school-accent)] text-black" onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!closeOpen} onOpenChange={() => setCloseOpen(null)}>
        <DialogContent className="bg-[#192734] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Clôturer le signalement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="pb-sol">Solution / décision</Label>
              <Textarea
                id="pb-sol"
                className="bg-[#0F1419] border-white/10 mt-1 min-h-[80px]"
                value={closeSolution}
                onChange={(e) => setCloseSolution(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="pb-next">Prochaine étape (optionnel)</Label>
              <Textarea
                id="pb-next"
                className="bg-[#0F1419] border-white/10 mt-1 min-h-[60px]"
                value={closeNext}
                onChange={(e) => setCloseNext(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCloseOpen(null)} disabled={saving}>
              Annuler
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleCloseReport} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Marquer résolu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProblemsSection;
