import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import DataTable from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Activity, HeartPulse, Plus, Trash, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Shared hook: load all students for dropdowns
const useStudents = () => {
  const [students, setStudents] = useState([]);
  useEffect(() => {
    supabase.from('profiles').select('id,name,email').eq('role', 'student').order('name').limit(500)
      .then(({ data }) => setStudents(data || []));
  }, []);
  return students;
};

const studentName = (row) =>
  row.profiles?.name || row.profiles?.email?.split('@')[0] || row.student_id?.slice(0, 8) || '—';

// ─── ABSENCES MANAGER ────────────────────────────────────────────────────────
export const AbsencesManager = () => {
  const { toast } = useToast();
  const students = useStudents();
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm]     = useState({ studentId: '', date: '', reason: 'Maladie', justified: false });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('attendance_records')
      .select('id,student_id,status,attendance_date,note,profiles(name,email)')
      .in('status', ['absent', 'excused'])
      .is('deleted_at', null)
      .order('attendance_date', { ascending: false })
      .limit(500);
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    if (!form.studentId || !form.date) return;
    const { error } = await supabase.from('attendance_records').insert({
      student_id:      form.studentId,
      attendance_date: form.date,
      status:          form.justified ? 'excused' : 'absent',
      note:            form.reason || null,
      teacher_id:      (await supabase.auth.getUser()).data?.user?.id,
    });
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Absence enregistrée' });
    setIsOpen(false);
    setForm({ studentId: '', date: '', reason: 'Maladie', justified: false });
    void load();
  };

  const handleDelete = async (id) => {
    await supabase.from('attendance_records').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    void load();
  };

  const columns = [
    { key: 'student_id', label: 'Étudiant', render: (_, row) => (
      <div><p className="font-medium text-white">{studentName(row)}</p><p className="text-xs text-gray-500">{row.profiles?.email || ''}</p></div>
    )},
    { key: 'attendance_date', label: 'Date', render: (val) => val ? new Date(val).toLocaleDateString('fr-FR') : '—' },
    { key: 'note', label: 'Motif', render: (val) => val || '—' },
    { key: 'status', label: 'Statut', render: (val) => (
      <Badge className={val === 'excused' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
        {val === 'excused' ? 'Justifiée' : 'Injustifiée'}
      </Badge>
    )},
    { key: 'id', label: 'Actions', render: (id) => (
      <Button size="sm" variant="destructive" onClick={() => handleDelete(id)}><Trash className="w-3 h-3" /></Button>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-white flex items-center gap-2"><Clock className="w-5 h-5 text-purple-500" /> Gestion des Absences</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="border-white/10 text-gray-400"><Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
          <Button onClick={() => setIsOpen(true)} className="bg-purple-600 hover:bg-purple-700"><Plus className="w-4 h-4 mr-2" /> Nouvelle Absence</Button>
        </div>
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : <DataTable columns={columns} data={rows} searchFields={[]} />}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-[#192734] border-white/10 text-white">
          <DialogHeader><DialogTitle>Nouvelle Absence</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Select onValueChange={(v) => setForm({ ...form, studentId: v })}>
              <SelectTrigger className="bg-[#0F1419] border-white/10"><SelectValue placeholder="Sélectionner un étudiant" /></SelectTrigger>
              <SelectContent>{students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name || s.email}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="bg-[#0F1419] border-white/10 text-white" />
            <Input placeholder="Motif" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="bg-[#0F1419] border-white/10 text-white" />
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.justified} onChange={(e) => setForm({ ...form, justified: e.target.checked })} />
              Absence justifiée
            </label>
            <Button onClick={handleSave} className="w-full bg-purple-600">Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── DELAYS MANAGER ───────────────────────────────────────────────────────────
export const DelaysManager = () => {
  const { toast } = useToast();
  const students = useStudents();
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm]     = useState({ studentId: '', date: '', note: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('attendance_records')
      .select('id,student_id,attendance_date,note,profiles(name,email)')
      .eq('status', 'late')
      .is('deleted_at', null)
      .order('attendance_date', { ascending: false })
      .limit(500);
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    if (!form.studentId || !form.date) return;
    const { error } = await supabase.from('attendance_records').insert({
      student_id:      form.studentId,
      attendance_date: form.date,
      status:          'late',
      note:            form.note || null,
      teacher_id:      (await supabase.auth.getUser()).data?.user?.id,
    });
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Retard enregistré' });
    setIsOpen(false);
    setForm({ studentId: '', date: '', note: '' });
    void load();
  };

  const handleDelete = async (id) => {
    await supabase.from('attendance_records').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    void load();
  };

  const columns = [
    { key: 'student_id', label: 'Étudiant', render: (_, row) => (
      <div><p className="font-medium text-white">{studentName(row)}</p><p className="text-xs text-gray-500">{row.profiles?.email || ''}</p></div>
    )},
    { key: 'attendance_date', label: 'Date', render: (val) => val ? new Date(val).toLocaleDateString('fr-FR') : '—' },
    { key: 'note', label: 'Note', render: (val) => val || '—' },
    { key: 'id', label: 'Actions', render: (id) => (
      <Button size="sm" variant="destructive" onClick={() => handleDelete(id)}><Trash className="w-3 h-3" /></Button>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-white flex items-center gap-2"><Activity className="w-5 h-5 text-yellow-500" /> Gestion des Retards</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="border-white/10 text-gray-400"><Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
          <Button onClick={() => setIsOpen(true)} className="bg-yellow-600 hover:bg-yellow-700 text-black"><Plus className="w-4 h-4 mr-2" /> Nouveau Retard</Button>
        </div>
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : <DataTable columns={columns} data={rows} searchFields={[]} />}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-[#192734] border-white/10 text-white">
          <DialogHeader><DialogTitle>Nouveau Retard</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Select onValueChange={(v) => setForm({ ...form, studentId: v })}>
              <SelectTrigger className="bg-[#0F1419] border-white/10"><SelectValue placeholder="Sélectionner un étudiant" /></SelectTrigger>
              <SelectContent>{students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name || s.email}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="bg-[#0F1419] border-white/10 text-white" />
            <Input placeholder="Note (optionnel)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="bg-[#0F1419] border-white/10 text-white" />
            <Button onClick={handleSave} className="w-full bg-yellow-600 text-black">Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── ILLNESS / LEAVE MANAGER ──────────────────────────────────────────────────
export const IllnessLeaveManager = () => {
  const { toast } = useToast();
  const students = useStudents();
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm]     = useState({ studentId: '', startDate: '', endDate: '', leave_type: 'illness', certificate: false, note: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('school_life_records')
      .select('id,student_id,leave_type,start_date,end_date,certificate,note,status,profiles(name,email)')
      .eq('record_type', 'illness_leave')
      .order('created_at', { ascending: false })
      .limit(300);
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    if (!form.studentId || !form.startDate) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('school_life_records').insert({
      student_id:  form.studentId,
      record_type: 'illness_leave',
      leave_type:  form.leave_type,
      start_date:  form.startDate,
      end_date:    form.endDate || null,
      certificate: form.certificate,
      note:        form.note || null,
      status:      'active',
      created_by:  user?.id,
    });
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Dossier enregistré' });
    setIsOpen(false);
    setForm({ studentId: '', startDate: '', endDate: '', leave_type: 'illness', certificate: false, note: '' });
    void load();
  };

  const handleDelete = async (id) => {
    await supabase.from('school_life_records').delete().eq('id', id);
    void load();
  };

  const columns = [
    { key: 'student_id', label: 'Étudiant', render: (_, row) => (
      <div><p className="font-medium text-white">{studentName(row)}</p><p className="text-xs text-gray-500">{row.profiles?.email || ''}</p></div>
    )},
    { key: 'leave_type', label: 'Type', render: (val) => <Badge variant="outline">{val === 'illness' ? 'Maladie' : val === 'leave' ? 'Congé' : 'Autre'}</Badge> },
    { key: 'start_date', label: 'Début', render: (val) => val ? new Date(val).toLocaleDateString('fr-FR') : '—' },
    { key: 'end_date',   label: 'Fin',   render: (val) => val ? new Date(val).toLocaleDateString('fr-FR') : '—' },
    { key: 'certificate', label: 'Certificat', render: (val) => <Badge className={val ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>{val ? 'Oui' : 'Non'}</Badge> },
    { key: 'id', label: 'Actions', render: (id) => (
      <Button size="sm" variant="destructive" onClick={() => handleDelete(id)}><Trash className="w-3 h-3" /></Button>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-white flex items-center gap-2"><HeartPulse className="w-5 h-5 text-green-500" /> Maladie &amp; Congés</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="border-white/10 text-gray-400"><Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
          <Button onClick={() => setIsOpen(true)} className="bg-green-600 hover:bg-green-700"><Plus className="w-4 h-4 mr-2" /> Nouveau Dossier</Button>
        </div>
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : <DataTable columns={columns} data={rows} searchFields={[]} />}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-[#192734] border-white/10 text-white">
          <DialogHeader><DialogTitle>Nouveau Dossier Santé</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Select onValueChange={(v) => setForm({ ...form, studentId: v })}>
              <SelectTrigger className="bg-[#0F1419] border-white/10"><SelectValue placeholder="Sélectionner un étudiant" /></SelectTrigger>
              <SelectContent>{students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name || s.email}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
              <SelectTrigger className="bg-[#0F1419] border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="illness">Maladie</SelectItem>
                <SelectItem value="leave">Congé</SelectItem>
                <SelectItem value="other">Autre</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-4">
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="bg-[#0F1419] border-white/10 text-white" />
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="bg-[#0F1419] border-white/10 text-white" />
            </div>
            <Input placeholder="Note (optionnel)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="bg-[#0F1419] border-white/10 text-white" />
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.certificate} onChange={(e) => setForm({ ...form, certificate: e.target.checked })} />
              Certificat fourni
            </label>
            <Button onClick={handleSave} className="w-full bg-green-600">Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
