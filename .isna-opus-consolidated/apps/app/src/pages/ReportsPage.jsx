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
          .from('billing_payments')
          .select('id,payment_status,price_amount,created_at')
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
      .filter((p) => String(p.payment_status || '').toLowerCase() === 'confirmed')
      .forEach((p) => {
        const d = new Date(p.created_at || Date.now());
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        if (byMonth[key]) byMonth[key].revenue += Number(p.price_amount || 0);
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
    const paid = payments.filter((i) => String(i.payment_status || '').toLowerCase() === 'confirmed').length;
    const pending = payments.filter((i) => ['pending', 'confirming'].includes(String(i.payment_status || '').toLowerCase())).length;
    const overdue = payments.filter((i) => ['failed', 'expired'].includes(String(i.payment_status || '').toLowerCase())).length;
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
                    <Card className="bg-[#192734] border-white/10">
                       <CardHeader><CardTitle className="text-white">Revenus Mensuels (Année Courante)</CardTitle></CardHeader>
                       <CardContent>
                          <SimpleAreaChart data={revenueData} xKey="name" dataKey="revenue" />
                       </CardContent>
                    </Card>
                    <Card className="bg-[#192734] border-white/10">
                       <CardHeader><CardTitle className="text-white">État des Factures</CardTitle></CardHeader>
                       <CardContent>
                          <SimplePieChart data={invoiceData} nameKey="name" dataKey="value" />
                       </CardContent>
                    </Card>
                 </div>
                 <Card className="bg-[#192734] border-white/10">
                    <CardHeader><CardTitle className="text-white">Progression du Chiffre d'Affaires</CardTitle></CardHeader>
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
                    <Card className="bg-[#192734] border-white/10">
                       <CardHeader><CardTitle className="text-white">Répartition des Étudiants</CardTitle></CardHeader>
                       <CardContent>
                          <SimplePieChart data={studentStatusData} nameKey="name" dataKey="value" />
                       </CardContent>
                    </Card>
                    <Card className="bg-[#192734] border-white/10">
                       <CardHeader><CardTitle className="text-white">Nouveaux Inscrits (6 derniers mois)</CardTitle></CardHeader>
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
        <h1 className="text-3xl font-bold text-white">Rapports & Analytique</h1>
        <div className="flex gap-4">
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-[200px] bg-[#192734] border-white/10 text-white">
              <SelectValue placeholder="Type de rapport" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="financial">Rapport Financier</SelectItem>
              <SelectItem value="students">Rapport Étudiants</SelectItem>
              <SelectItem value="formations">Performance Formations</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="border-white/10 text-white hover:bg-white/10">
            <Download className="w-4 h-4 mr-2" /> Exporter PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-gray-400 flex items-center"><Loader2 className="w-4 h-4 mr-2 animate-spin" />Chargement des donnees reelles...</div>
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