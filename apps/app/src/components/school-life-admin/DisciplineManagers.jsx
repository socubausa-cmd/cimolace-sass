import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import DataTable from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, ShieldAlert, Gavel, Star, Trash, Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Shared helpers
const useStudents = () => {
  const [students, setStudents] = useState([]);
  useEffect(() => {
    supabase.from('profiles').select('id,name,email').eq('role', 'student').order('name').limit(500)
      .then(({ data }) => setStudents(data || []));
  }, []);
  return students;
};

const studentName = (row) =>
  row.profiles?.name || row.profiles?.email?.split('@')[0] || '—';

const useRecords = (recordType) => {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('school_life_records')
      .select('id,student_id,record_type,status,note,reason,severity,rating,domain,scheduled_at,location,created_at,profiles(name,email)')
      .eq('record_type', recordType)
      .order('created_at', { ascending: false })
      .limit(300);
    setRows(data || []);
    setLoading(false);
  }, [recordType]);

  useEffect(() => { void load(); }, [load]);

  const remove = async (id) => {
    await supabase.from('school_life_records').delete().eq('id', id);
    void load();
  };

  return { rows, loading, load, remove };
};

const insertRecord = async (payload) => {
  const { data: { user } } = await supabase.auth.getUser();
  return supabase.from('school_life_records').insert({ ...payload, created_by: user?.id });
};

// ─── WARNINGS MANAGER ────────────────────────────────────────────────────────
export const WarningsManager = () => {
  const { toast } = useToast();
  const students = useStudents();
  const { rows, loading, load, remove } = useRecords('warning');
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm]     = useState({ studentId: '', type: 'Comportement', reason: '' });

  const handleSave = async () => {
    if (!form.studentId) return;
    const { error } = await insertRecord({
      student_id:  form.studentId,
      record_type: 'warning',
      note:        form.type,
      reason:      form.reason,
      status:      'active',
      severity:    'low',
    });
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Avertissement enregistré' });
    setIsOpen(false);
    setForm({ studentId: '', type: 'Comportement', reason: '' });
    void load();
  };

  const columns = [
    { key: 'student_id', label: 'Étudiant', render: (_, row) => <span className="text-white font-medium">{studentName(row)}</span> },
    { key: 'note',   label: 'Type',   render: (val) => val || '—' },
    { key: 'reason', label: 'Motif',  render: (val) => val || '—' },
    { key: 'created_at', label: 'Date', render: (val) => val ? new Date(val).toLocaleDateString('fr-FR') : '—' },
    { key: 'status', label: 'Statut', render: (val) => <Badge className={val === 'active' ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-500/20 text-gray-400'}>{val === 'active' ? 'Actif' : 'Résolu'}</Badge> },
    { key: 'id', label: '', render: (id) => <Button size="sm" variant="destructive" onClick={() => remove(id)}><Trash className="w-3 h-3" /></Button> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-white flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-orange-500" /> Avertissements ({rows.length})</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="border-white/10 text-gray-400"><Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
          <Button onClick={() => setIsOpen(true)} className="bg-orange-600 hover:bg-orange-700"><Plus className="w-4 h-4 mr-2" /> Ajouter</Button>
        </div>
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <div className="text-center py-10 text-gray-500 border border-dashed border-white/10 rounded-xl">Aucun avertissement.</div>
        : <DataTable columns={columns} data={rows} searchFields={[]} />}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-[#192734] border-white/10 text-white">
          <DialogHeader><DialogTitle>Nouvel Avertissement</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Select onValueChange={(v) => setForm({ ...form, studentId: v })}>
              <SelectTrigger className="bg-[#0F1419] border-white/10"><SelectValue placeholder="Sélectionner un étudiant" /></SelectTrigger>
              <SelectContent>{students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name || s.email}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Type (Comportement, Retard…)" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="bg-[#0F1419] border-white/10 text-white" />
            <Input placeholder="Raison détaillée" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="bg-[#0F1419] border-white/10 text-white" />
            <Button onClick={handleSave} className="w-full bg-orange-600">Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── SANCTIONS MANAGER ────────────────────────────────────────────────────────
export const SanctionsManager = () => {
  const { toast } = useToast();
  const students = useStudents();
  const { rows, loading, load, remove } = useRecords('sanction');
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm]     = useState({ studentId: '', type: 'Blâme', reason: '', severity: 'low' });

  const handleSave = async () => {
    if (!form.studentId) return;
    const { error } = await insertRecord({
      student_id:  form.studentId,
      record_type: 'sanction',
      note:        form.type,
      reason:      form.reason,
      severity:    form.severity,
      status:      'active',
    });
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Sanction enregistrée' });
    setIsOpen(false);
    setForm({ studentId: '', type: 'Blâme', reason: '', severity: 'low' });
    void load();
  };

  const severityColor = (s) => s === 'high' ? 'bg-red-500/20 text-red-400' : s === 'medium' ? 'bg-orange-500/20 text-orange-400' : 'bg-yellow-500/20 text-yellow-400';

  const columns = [
    { key: 'student_id', label: 'Étudiant', render: (_, row) => <span className="text-white font-medium">{studentName(row)}</span> },
    { key: 'note',     label: 'Sanction', render: (val) => val || '—' },
    { key: 'severity', label: 'Gravité',  render: (val) => <Badge className={severityColor(val)}>{val === 'high' ? 'Haute' : val === 'medium' ? 'Moyenne' : 'Faible'}</Badge> },
    { key: 'created_at', label: 'Date',   render: (val) => val ? new Date(val).toLocaleDateString('fr-FR') : '—' },
    { key: 'status',   label: 'Statut',   render: (val) => <Badge className={val === 'active' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}>{val === 'active' ? 'En cours' : 'Résolu'}</Badge> },
    { key: 'id', label: '', render: (id) => <Button size="sm" variant="destructive" onClick={() => remove(id)}><Trash className="w-3 h-3" /></Button> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-white flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-red-500" /> Sanctions ({rows.length})</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="border-white/10 text-gray-400"><Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
          <Button onClick={() => setIsOpen(true)} className="bg-red-600 hover:bg-red-700"><Plus className="w-4 h-4 mr-2" /> Appliquer Sanction</Button>
        </div>
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <div className="text-center py-10 text-gray-500 border border-dashed border-white/10 rounded-xl">Aucune sanction.</div>
        : <DataTable columns={columns} data={rows} searchFields={[]} />}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-[#192734] border-white/10 text-white">
          <DialogHeader><DialogTitle>Nouvelle Sanction</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Select onValueChange={(v) => setForm({ ...form, studentId: v })}>
              <SelectTrigger className="bg-[#0F1419] border-white/10"><SelectValue placeholder="Sélectionner un étudiant" /></SelectTrigger>
              <SelectContent>{students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name || s.email}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Type de sanction" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="bg-[#0F1419] border-white/10 text-white" />
            <Input placeholder="Raison" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="bg-[#0F1419] border-white/10 text-white" />
            <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
              <SelectTrigger className="bg-[#0F1419] border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Faible</SelectItem>
                <SelectItem value="medium">Moyenne</SelectItem>
                <SelectItem value="high">Haute</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSave} className="w-full bg-red-600">Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── CONVOCATIONS MANAGER ─────────────────────────────────────────────────────
export const ConvocationsManager = () => {
  const { toast } = useToast();
  const students = useStudents();
  const { rows, loading, load, remove } = useRecords('convocation');
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm]     = useState({ studentId: '', scheduled_at: '', location: '', reason: '' });

  const handleSave = async () => {
    if (!form.studentId || !form.scheduled_at) return;
    const { error } = await insertRecord({
      student_id:   form.studentId,
      record_type:  'convocation',
      scheduled_at: form.scheduled_at,
      location:     form.location || null,
      reason:       form.reason || null,
      status:       'scheduled',
    });
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Convocation créée' });
    setIsOpen(false);
    setForm({ studentId: '', scheduled_at: '', location: '', reason: '' });
    void load();
  };

  const columns = [
    { key: 'student_id',   label: 'Étudiant', render: (_, row) => <span className="text-white font-medium">{studentName(row)}</span> },
    { key: 'scheduled_at', label: 'Date',     render: (val) => val ? new Date(val).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' },
    { key: 'location',     label: 'Lieu',     render: (val) => val || '—' },
    { key: 'reason',       label: 'Motif',    render: (val) => val || '—' },
    { key: 'status',       label: 'Statut',   render: (val) => <Badge className="bg-indigo-500/20 text-indigo-400">{val}</Badge> },
    { key: 'id', label: '', render: (id) => <Button size="sm" variant="destructive" onClick={() => remove(id)}><Trash className="w-3 h-3" /></Button> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-white flex items-center gap-2"><Gavel className="w-5 h-5 text-indigo-500" /> Convocations ({rows.length})</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="border-white/10 text-gray-400"><Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
          <Button onClick={() => setIsOpen(true)} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4 mr-2" /> Convoquer</Button>
        </div>
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <div className="text-center py-10 text-gray-500 border border-dashed border-white/10 rounded-xl">Aucune convocation.</div>
        : <DataTable columns={columns} data={rows} searchFields={[]} />}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-[#192734] border-white/10 text-white">
          <DialogHeader><DialogTitle>Nouvelle Convocation</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Select onValueChange={(v) => setForm({ ...form, studentId: v })}>
              <SelectTrigger className="bg-[#0F1419] border-white/10"><SelectValue placeholder="Sélectionner un étudiant" /></SelectTrigger>
              <SelectContent>{students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name || s.email}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} className="bg-[#0F1419] border-white/10 text-white" />
            <Input placeholder="Lieu" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="bg-[#0F1419] border-white/10 text-white" />
            <Input placeholder="Motif" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="bg-[#0F1419] border-white/10 text-white" />
            <Button onClick={handleSave} className="w-full bg-indigo-600">Créer la convocation</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── BEHAVIOR MANAGER ─────────────────────────────────────────────────────────
export const BehaviorManager = () => {
  const { toast } = useToast();
  const students = useStudents();
  const { rows, loading, load, remove } = useRecords('behavior');
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm]     = useState({ studentId: '', rating: 'good', domain: 'Participation', note: '' });

  const handleSave = async () => {
    if (!form.studentId) return;
    const { error } = await insertRecord({
      student_id:  form.studentId,
      record_type: 'behavior',
      rating:      form.rating,
      domain:      form.domain,
      note:        form.note || null,
      status:      'active',
    });
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Note de comportement enregistrée' });
    setIsOpen(false);
    setForm({ studentId: '', rating: 'good', domain: 'Participation', note: '' });
    void load();
  };

  const ratingColor = (r) => r === 'good' ? 'bg-green-500/20 text-green-400' : r === 'average' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400';
  const ratingLabel = (r) => r === 'good' ? 'Bon' : r === 'average' ? 'Moyen' : 'Mauvais';

  const columns = [
    { key: 'student_id', label: 'Étudiant', render: (_, row) => <span className="text-white font-medium">{studentName(row)}</span> },
    { key: 'domain',     label: 'Domaine', render: (val) => val || '—' },
    { key: 'rating',     label: 'Note',    render: (val) => <Badge className={ratingColor(val)}>{ratingLabel(val)}</Badge> },
    { key: 'note',       label: 'Commentaire', render: (val) => <span className="text-gray-400 text-sm">{val || '—'}</span> },
    { key: 'created_at', label: 'Date',    render: (val) => val ? new Date(val).toLocaleDateString('fr-FR') : '—' },
    { key: 'id', label: '', render: (id) => <Button size="sm" variant="destructive" onClick={() => remove(id)}><Trash className="w-3 h-3" /></Button> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-white flex items-center gap-2"><Star className="w-5 h-5 text-yellow-500" /> Comportement ({rows.length})</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="border-white/10 text-gray-400"><Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
          <Button onClick={() => setIsOpen(true)} className="bg-yellow-600 hover:bg-yellow-700 text-black"><Plus className="w-4 h-4 mr-2" /> Nouvelle Note</Button>
        </div>
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <div className="text-center py-10 text-gray-500 border border-dashed border-white/10 rounded-xl">Aucune note de comportement.</div>
        : <DataTable columns={columns} data={rows} searchFields={[]} />}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-[#192734] border-white/10 text-white">
          <DialogHeader><DialogTitle>Note de Comportement</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Select onValueChange={(v) => setForm({ ...form, studentId: v })}>
              <SelectTrigger className="bg-[#0F1419] border-white/10"><SelectValue placeholder="Sélectionner un étudiant" /></SelectTrigger>
              <SelectContent>{students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name || s.email}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Domaine (Participation, Ponctualité…)" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} className="bg-[#0F1419] border-white/10 text-white" />
            <Select value={form.rating} onValueChange={(v) => setForm({ ...form, rating: v })}>
              <SelectTrigger className="bg-[#0F1419] border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="good">Bon</SelectItem>
                <SelectItem value="average">Moyen</SelectItem>
                <SelectItem value="bad">Mauvais</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Commentaire" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="bg-[#0F1419] border-white/10 text-white" />
            <Button onClick={handleSave} className="w-full bg-yellow-600 text-black">Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
