import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, AlertTriangle, Clock, Calendar, ShieldAlert, HeartPulse, Megaphone, Activity } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const StatCard = ({ title, value, icon: Icon, color, subtext }) => (
  <Card className="bg-[#192734] border-white/10 hover:border-[#D4AF37]/50 transition-all">
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <h3 className="text-2xl font-bold text-white mt-2">{value}</h3>
          {subtext && <p className="text-sm text-gray-500 mt-1">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color} bg-opacity-20`}>
          <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
        </div>
      </div>
    </CardContent>
  </Card>
);

const SchoolLifeDashboard = () => {
  const [stats, setStats] = useState({
    students: 0, warnings: 0, absences: 0, delays: 0,
    convocations: 0, sanctions: 0, illness: 0, events: 0,
  });
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  const refresh = useCallback(async () => {
    const nowIso = new Date().toISOString();
    const [studentsRes, attendanceRes, eventsRes, disciplineRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
      // Fixed: correct column name is 'status', not 'attendance_status'
      supabase.from('attendance_records').select('id,status').is('deleted_at', null).limit(5000),
      // Fixed: correct column name is 'start_at', not 'event_date'
      supabase.from('school_events').select('id,title,start_at,location').order('start_at', { ascending: true }).limit(200),
      // Real discipline data from school_life_records
      supabase.from('school_life_records').select('id,record_type,status').limit(2000),
    ]);

    const attendance = attendanceRes.data || [];
    const eventsRows = eventsRes.data || [];
    const discipline = disciplineRes.data || [];

    const upcoming = eventsRows.filter((e) => String(e.start_at || '') >= nowIso);

    setStats({
      students:     Number(studentsRes.count || 0),
      absences:     attendance.filter((r) => r.status === 'absent').length,
      delays:       attendance.filter((r) => r.status === 'late').length,
      warnings:     discipline.filter((r) => r.record_type === 'warning' && r.status === 'active').length,
      sanctions:    discipline.filter((r) => r.record_type === 'sanction' && r.status === 'active').length,
      convocations: discipline.filter((r) => r.record_type === 'convocation' && r.status === 'scheduled').length,
      illness:      discipline.filter((r) => r.record_type === 'illness_leave' && r.status === 'active').length,
      events:       eventsRows.length,
    });
    setUpcomingEvents(upcoming.slice(0, 5));
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const channel = supabase
      .channel('school-life-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'school_events' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'school_life_records' }, () => void refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  const chartData = useMemo(() => [
    { name: 'Avertissements', count: stats.warnings },
    { name: 'Absences',       count: stats.absences },
    { name: 'Retards',        count: stats.delays },
    { name: 'Sanctions',      count: stats.sanctions },
    { name: 'Convocations',   count: stats.convocations },
  ], [stats]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Étudiants"       value={stats.students}     icon={Users}       color="bg-blue-500 text-blue-500" />
        <StatCard title="Avertissements Actifs" value={stats.warnings}     icon={AlertTriangle} color="bg-orange-500 text-orange-500" subtext="Nécessitent attention" />
        <StatCard title="Absences (Total)"      value={stats.absences}     icon={Clock}       color="bg-purple-500 text-purple-500" />
        <StatCard title="Retards (Total)"       value={stats.delays}       icon={Activity}    color="bg-yellow-500 text-yellow-500" />
        <StatCard title="Convocations à venir"  value={stats.convocations} icon={Calendar}    color="bg-indigo-500 text-indigo-500" />
        <StatCard title="Sanctions en cours"    value={stats.sanctions}    icon={ShieldAlert} color="bg-red-500 text-red-500" />
        <StatCard title="Arrêts Maladie"        value={stats.illness}      icon={HeartPulse}  color="bg-green-500 text-green-500" />
        <StatCard title="Événements"            value={stats.events}       icon={Megaphone}   color="bg-pink-500 text-pink-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-[#192734] border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Vue d&apos;ensemble des Incidents</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#888" tick={{ fontSize: 11 }} />
                <YAxis stroke="#888" allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', color: '#fff' }} />
                <Bar dataKey="count" fill="#D4AF37" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-[#192734] border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Prochains Événements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border-l-4 border-indigo-500">
                    <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{event.title || 'Événement'}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(event.start_at).toLocaleDateString('fr-FR')}
                        {event.location ? ` · ${event.location}` : ''}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4 text-sm">Aucun événement à venir.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SchoolLifeDashboard;
