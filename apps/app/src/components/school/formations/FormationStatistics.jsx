import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Users, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

const COLORS = ['#D4AF37', '#0088FE', '#00C49F', '#FF8042'];

const FormationStatistics = ({ formation }) => {
  const enrolledStudents = formation?.enrolledStudents ?? [];
  const modules = formation?.modules ?? [];

  // Key Metrics
  const totalStudents = enrolledStudents.length;
  const activeStudents = enrolledStudents.filter(s => s.status === 'in_progress').length;
  const completedStudents = enrolledStudents.filter(s => s.status === 'completed').length;
  const suspendedStudents = enrolledStudents.filter(s => s.status === 'suspended').length;
  const avgProgress = Math.round(enrolledStudents.reduce((acc, s) => acc + s.progress, 0) / totalStudents) || 0;

  // Chart Data: Status Distribution
  const statusData = [
    { name: 'En cours', value: activeStudents },
    { name: 'Complété', value: completedStudents },
    { name: 'Suspendu', value: suspendedStudents },
    { name: 'Non commencé', value: enrolledStudents.filter(s => s.status === 'not_started').length }
  ];

  // Chart Data: Progress Bins
  const progressBins = [
    { name: '0-25%', count: enrolledStudents.filter(s => s.progress <= 25).length },
    { name: '26-50%', count: enrolledStudents.filter(s => s.progress > 25 && s.progress <= 50).length },
    { name: '51-75%', count: enrolledStudents.filter(s => s.progress > 50 && s.progress <= 75).length },
    { name: '76-100%', count: enrolledStudents.filter(s => s.progress > 75).length }
  ];

  // Chart Data: Module Complexity (Mock data based on module order)
  const modulePerformance = modules.map(m => ({
    name: `Mod ${m.order}`,
    avgScore: Math.floor(Math.random() * (95 - 65) + 65), // Mock score
    completion: Math.floor(Math.random() * (100 - 40) + 40) // Mock completion rate
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#151a21]/80 backdrop-blur border-white/10">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Étudiants</p>
              <h3 className="text-2xl font-bold text-white">{totalStudents}</h3>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-full text-blue-400"><Users size={20}/></div>
          </CardContent>
        </Card>
        <Card className="bg-[#151a21]/80 backdrop-blur border-white/10">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Complétion</p>
              <h3 className="text-2xl font-bold text-white">{completedStudents}</h3>
            </div>
            <div className="p-3 bg-green-500/10 rounded-full text-green-400"><CheckCircle size={20}/></div>
          </CardContent>
        </Card>
        <Card className="bg-[#151a21]/80 backdrop-blur border-white/10">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Progression Moy.</p>
              <h3 className="text-2xl font-bold text-[#D4AF37]">{avgProgress}%</h3>
            </div>
            <div className="p-3 bg-[#D4AF37]/10 rounded-full text-[#D4AF37]"><Clock size={20}/></div>
          </CardContent>
        </Card>
        <Card className="bg-[#151a21]/80 backdrop-blur border-white/10">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Suspendus</p>
              <h3 className="text-2xl font-bold text-red-400">{suspendedStudents}</h3>
            </div>
            <div className="p-3 bg-red-500/10 rounded-full text-red-400"><AlertTriangle size={20}/></div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-[#151a21]/80 backdrop-blur border-white/10">
          <CardHeader><CardTitle className="text-white text-lg">Répartition des Statuts</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{backgroundColor: '#0F1419', border: '1px solid #333', borderRadius: '8px'}} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 text-sm text-gray-400 mt-2">
              {statusData.map((entry, index) => (
                <div key={index} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                  {entry.name} ({entry.value})
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#151a21]/80 backdrop-blur border-white/10">
          <CardHeader><CardTitle className="text-white text-lg">Distribution de la Progression</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progressBins}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: '#0F1419', border: '1px solid #333', color: '#fff'}} />
                <Bar dataKey="count" fill="#D4AF37" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <Card className="bg-[#151a21]/80 backdrop-blur border-white/10">
        <CardHeader><CardTitle className="text-white text-lg">Performance par Module</CardTitle></CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={modulePerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip contentStyle={{backgroundColor: '#0F1419', border: '1px solid #333', color: '#fff'}} />
              <Line type="monotone" dataKey="avgScore" stroke="#00C49F" name="Score Quiz Moyen" strokeWidth={2} />
              <Line type="monotone" dataKey="completion" stroke="#D4AF37" name="Taux Complétion" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default FormationStatistics;