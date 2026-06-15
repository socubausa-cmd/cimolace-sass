import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SimpleLineChart, SimpleBarChart, SimplePieChart, SimpleAreaChart } from '@/components/reports/AdvancedCharts';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AnimatePresence, motion } from 'framer-motion';

/* Thème CLAIR « Wix Studio » — aligné sur OwnerDashboardOverview. */
const LT_TEXT = '#18181B';
const LT_SUB = '#52525B';
const LT_MUTED = '#71717A';
const LT_BORDER = 'rgba(0,0,0,0.08)';
const panelSurface = {
  background: '#FFFFFF',
  border: `1px solid ${LT_BORDER}`,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const ReportsPage = () => {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [reportType, setReportType] = useState('financial');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      const [{ data: payRows }, { data: profileRows }] = await Promise.all([
        supabase
          .from('billing_invoices')
          .select('id,status,amount_cents,created_at')
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase
          .from('profiles')
          .select('id,status,created_at,role')
          .eq('role', 'student'),
      ]);
      if (!alive) return;
      setPayments(payRows || []);
      setProfiles(profileRows || []);
      setLoading(false);
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const revenueData = useMemo(() => {
    const byMonth = {};
    const now = new Date();
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      byMonth[key] = { name: format(d, 'MMM', { locale: fr }), revenue: 0 };
    }
    payments
      .filter((p) => String(p.status || '').toLowerCase() === 'paid')
      .forEach((p) => {
        const d = new Date(p.created_at || Date.now());
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        if (byMonth[key]) byMonth[key].revenue += Number(p.amount_cents || 0) / 100;
      });
    return Object.values(byMonth);
  }, [payments]);

  const studentStatusData = useMemo(() => {
    const active = profiles.filter((s) => String(s.status || '').toLowerCase() === 'active').length;
    const inactive = profiles.filter((s) => String(s.status || '').toLowerCase() === 'inactive').length;
    const suspended = profiles.filter((s) => String(s.status || '').toLowerCase() === 'suspended').length;
    const graduated = profiles.filter((s) => String(s.status || '').toLowerCase() === 'graduated').length;
    return [
      { name: 'Actif', value: active },
      { name: 'Inactif', value: inactive },
      { name: 'Suspendu', value: suspended },
      { name: 'Diplome', value: graduated },
    ];
  }, [profiles]);

  const invoiceData = useMemo(() => {
    const paid = payments.filter((i) => String(i.status || '').toLowerCase() === 'paid').length;
    const pending = payments.filter((i) => ['open', 'draft'].includes(String(i.status || '').toLowerCase())).length;
    const overdue = payments.filter((i) => ['void', 'uncollectible'].includes(String(i.status || '').toLowerCase())).length;
    return [
      { name: 'Payee', value: paid },
      { name: 'En attente', value: pending },
      { name: 'En retard', value: overdue },
    ];
  }, [payments]);

  const studentGrowthData = useMemo(() => {
    const byMonth = {};
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      byMonth[key] = { name: format(d, 'MMM', { locale: fr }), count: 0 };
    }
    profiles.forEach((p) => {
      const d = new Date(p.created_at || Date.now());
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (byMonth[key]) byMonth[key].count += 1;
    });
    return Object.values(byMonth);
  }, [profiles]);

  const renderContent = () => {
     switch(reportType) {
        case 'financial':
           return (
              <div className="space-y-6 animate-in slide-in-from-bottom-5">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="border-0" style={panelSurface}>
                       <CardHeader><CardTitle style={{ color: LT_TEXT }}>Revenus Mensuels (Année Courante)</CardTitle></CardHeader>
                       <CardContent>
                          <SimpleAreaChart data={revenueData} xKey="name" dataKey="revenue" />
                       </CardContent>
                    </Card>
                    <Card className="border-0" style={panelSurface}>
                       <CardHeader><CardTitle style={{ color: LT_TEXT }}>État des Factures</CardTitle></CardHeader>
                       <CardContent>
                          <SimplePieChart data={invoiceData} nameKey="name" dataKey="value" />
                       </CardContent>
                    </Card>
                 </div>
                 <Card className="border-0" style={panelSurface}>
                    <CardHeader><CardTitle style={{ color: LT_TEXT }}>Progression du Chiffre d'Affaires</CardTitle></CardHeader>
                    <CardContent>
                       <SimpleLineChart data={revenueData} xKey="name" dataKey="revenue" color="#22c55e" />
                    </CardContent>
                 </Card>
              </div>
           );
        case 'students':
           return (
              <div className="space-y-6 animate-in slide-in-from-bottom-5">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="border-0" style={panelSurface}>
                       <CardHeader><CardTitle style={{ color: LT_TEXT }}>Répartition des Étudiants</CardTitle></CardHeader>
                       <CardContent>
                          <SimplePieChart data={studentStatusData} nameKey="name" dataKey="value" />
                       </CardContent>
                    </Card>
                    <Card className="border-0" style={panelSurface}>
                       <CardHeader><CardTitle style={{ color: LT_TEXT }}>Nouveaux Inscrits (6 derniers mois)</CardTitle></CardHeader>
                       <CardContent>
                         <SimpleBarChart data={studentGrowthData} xKey="name" dataKey="count" color="#D4AF37" />
                       </CardContent>
                    </Card>
                 </div>
              </div>
           );
        default:
           return <div>Sélectionnez un rapport</div>;
     }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: LT_TEXT }}>Rapports &amp; Analytique</h1>
        <div className="flex gap-3">
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-[200px] bg-white border-black/10 text-zinc-900">
              <SelectValue placeholder="Type de rapport" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="financial">Rapport Financier</SelectItem>
              <SelectItem value="students">Rapport Étudiants</SelectItem>
              <SelectItem value="formations">Performance Formations</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="bg-white border-black/10 text-zinc-700 hover:bg-zinc-50">
            <Download className="w-4 h-4 mr-2" /> Exporter PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 flex items-center" style={{ color: LT_MUTED }}><Loader2 className="w-4 h-4 mr-2 animate-spin" />Chargement des donnees reelles...</div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={reportType}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};

export default ReportsPage;