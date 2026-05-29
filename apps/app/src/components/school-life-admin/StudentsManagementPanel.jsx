import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, RefreshCw, Eye, AlertTriangle, Clock, Activity, LayoutList, LayoutGrid, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import DataTable from '@/components/ui/DataTable';
import StudentProfileModal from './StudentProfileModal';
import { motion, AnimatePresence } from 'framer-motion';

const StudentsManagementPanel = () => {
  const [students, setStudents]     = useState([]);
  const [absenceCounts, setAbsenceCounts] = useState({});
  const [warningCounts, setWarningCounts] = useState({});
  const [loading, setLoading]       = useState(true);
  const [viewMode, setViewMode]     = useState(() => localStorage.getItem('studentViewMode') || 'card');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters]       = useState({ service: 'all', status: 'all' });
  const [selectedStudent, setSelectedStudent] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [profilesRes, enrollmentsRes, attendanceRes, disciplineRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id,name,email,avatar_url,status,phone,role')
        .eq('role', 'student')
        .order('name', { ascending: true })
        .limit(500),
      supabase
        .from('student_progress')
        .select('user_id,status,course_id,courses(title)')
        .in('status', ['active', 'completed'])
        .limit(2000),
      supabase
        .from('attendance_records')
        .select('student_id,status')
        .in('status', ['absent', 'late'])
        .is('deleted_at', null)
        .limit(10000),
      supabase
        .from('school_life_records')
        .select('student_id,record_type,status')
        .eq('record_type', 'warning')
        .eq('status', 'active')
        .limit(2000),
    ]);

    // Build attendance count map
    const absCounts = {};
    (attendanceRes.data || []).forEach((r) => {
      if (!absCounts[r.student_id]) absCounts[r.student_id] = 0;
      if (r.status === 'absent') absCounts[r.student_id] += 1;
    });
    setAbsenceCounts(absCounts);

    // Build warning count map
    const warnCounts = {};
    (disciplineRes.data || []).forEach((r) => {
      warnCounts[r.student_id] = (warnCounts[r.student_id] || 0) + 1;
    });
    setWarningCounts(warnCounts);

    // Build enrollment map: user_id → best enrollment
    const enrollMap = {};
    (enrollmentsRes.data || []).forEach((e) => {
      if (!enrollMap[e.user_id]) enrollMap[e.user_id] = e;
    });

    const mapped = (profilesRes.data || []).map((p) => {
      const enroll = enrollMap[p.id];
      return {
        id:          p.id,
        name:        p.name || p.email?.split('@')[0] || 'Étudiant',
        email:       p.email || '',
        avatar:      p.avatar_url || null,
        status:      p.status || 'active',
        phone:       p.phone || '',
        serviceType: 'academique',
        formation:   enroll?.courses?.title || null,
        enrollStatus: enroll?.status || null,
      };
    });

    setStudents(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { localStorage.setItem('studentViewMode', viewMode); }, [viewMode]);

  const filteredStudents = useMemo(() => students.filter((s) => {
    const searchMatch = !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase());
    const serviceMatch = filters.service === 'all' || s.serviceType === filters.service;
    const statusMatch  = filters.status  === 'all' || s.status === filters.status;
    return searchMatch && serviceMatch && statusMatch;
  }), [students, searchQuery, filters]);

  const getServiceBadge = (type) => {
    switch (type) {
      case 'prive':      return <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/50 text-[10px]">Privé</Badge>;
      case 'privilegie': return <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white border-none text-[10px]">Privilégié</Badge>;
      case 'autonome':   return <Badge className="bg-green-500/20 text-green-300 border-green-500/50 text-[10px]">Autonome</Badge>;
      default:           return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/50 text-[10px]">Académique</Badge>;
    }
  };

  const columns = [
    { key: 'name', label: 'Étudiant', render: (val, row) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={row.avatar} />
          <AvatarFallback>{String(val || '?').charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-bold text-white">{val}</p>
          <p className="text-sm text-gray-500">{row.email}</p>
        </div>
      </div>
    )},
    { key: 'serviceType', label: 'Service', render: (val) => getServiceBadge(val) },
    { key: 'formation',   label: 'Formation', render: (val) => val ? <span className="text-xs text-gray-300">{val}</span> : <span className="text-gray-500 text-xs">—</span> },
    { key: 'status', label: 'Statut', render: (val) => (
      <Badge className={val === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>{val === 'active' ? 'Actif' : 'Inactif'}</Badge>
    )},
    { key: 'id', label: 'Incidents', render: (id) => (
      <div className="flex gap-2 text-xs">
        <span className="text-orange-400">{warningCounts[id] || 0} Avert.</span>
        <span className="text-purple-400">{absenceCounts[id] || 0} Abs.</span>
      </div>
    )},
    { key: 'actions', label: 'Actions', render: (_, row) => (
      <Button size="sm" variant="ghost" className="hover:bg-white/10 hover:text-white" onClick={() => setSelectedStudent(row)}>
        <Eye className="w-4 h-4 mr-2" /> Voir Profil
      </Button>
    )},
  ];

  return (
    <div className="space-y-6">
      <Card className="bg-[#192734] border-white/10">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder={`Rechercher parmi ${students.length} étudiant(s)…`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-[#0F1419] border-white/10 text-white"
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Select value={filters.service} onValueChange={(v) => setFilters({ ...filters, service: v })}>
                <SelectTrigger className="w-[140px] bg-[#0F1419] border-white/10 text-white"><SelectValue placeholder="Service" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous services</SelectItem>
                  <SelectItem value="academique">Académique</SelectItem>
                  <SelectItem value="prive">Privé</SelectItem>
                  <SelectItem value="privilegie">Privilégié</SelectItem>
                  <SelectItem value="autonome">Autonome</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                <SelectTrigger className="w-[120px] bg-[#0F1419] border-white/10 text-white"><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="active">Actifs</SelectItem>
                  <SelectItem value="inactive">Inactifs</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => { setFilters({ service: 'all', status: 'all' }); setSearchQuery(''); void load(); }} className="border-white/10 text-gray-400 hover:text-white bg-transparent">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <div className="h-6 w-px bg-white/10 mx-1" />
              <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="icon" onClick={() => setViewMode('list')} className={viewMode === 'list' ? 'bg-[#D4AF37] text-black' : 'text-gray-400'}><LayoutList className="w-4 h-4" /></Button>
              <Button variant={viewMode === 'card' ? 'default' : 'ghost'} size="icon" onClick={() => setViewMode('card')} className={viewMode === 'card' ? 'bg-[#D4AF37] text-black' : 'text-gray-400'}><LayoutGrid className="w-4 h-4" /></Button>
            </div>
          </div>
          <div className="text-xs text-gray-500">{filteredStudents.length} / {students.length} étudiant(s) affiché(s)</div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" /> Chargement des étudiants…
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-12 text-gray-500 border border-dashed border-white/10 rounded-xl">
          Aucun étudiant trouvé.
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {viewMode === 'card' ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredStudents.map((student) => (
                <Card key={student.id} className="bg-[#192734] border-white/10 hover:border-[#D4AF37] transition-all group cursor-pointer" onClick={() => setSelectedStudent(student)}>
                  <CardContent className="p-0">
                    <div className="p-4 flex items-start gap-4">
                      <div className="relative shrink-0">
                        <Avatar className="h-14 w-14 border-2 border-[#D4AF37]/50">
                          <AvatarImage src={student.avatar} />
                          <AvatarFallback>{String(student.name || '?').charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[#192734] ${student.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-white truncate group-hover:text-[#D4AF37] transition-colors">{student.name}</h3>
                        <p className="text-sm text-gray-400 truncate mb-1">{student.email}</p>
                        <div className="flex gap-1 flex-wrap">
                          {getServiceBadge(student.serviceType)}
                          {student.formation && <Badge variant="outline" className="text-[10px] text-gray-400">{student.formation.slice(0, 20)}{student.formation.length > 20 ? '…' : ''}</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="bg-[#0F1419]/50 p-3 grid grid-cols-3 gap-2 border-t border-white/5">
                      <div className="text-center text-orange-400 font-bold text-sm" title="Avertissements"><AlertTriangle className="w-3 h-3 inline mr-1" />{warningCounts[student.id] || 0}</div>
                      <div className="text-center text-purple-400 font-bold text-sm" title="Absences"><Clock className="w-3 h-3 inline mr-1" />{absenceCounts[student.id] || 0}</div>
                      <div className="text-center text-blue-400 font-bold text-sm" title="Statut"><Activity className="w-3 h-3 inline mr-1" />{student.status === 'active' ? '✓' : '✗'}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DataTable columns={columns} data={filteredStudents} />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <StudentProfileModal
        student={selectedStudent}
        isOpen={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        dataSync={{ students, warnings: [], absences: [], behavior: [], evaluations: { completed: [] } }}
      />
    </div>
  );
};

export default StudentsManagementPanel;
