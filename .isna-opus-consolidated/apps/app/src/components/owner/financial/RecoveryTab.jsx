import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, FileText, Loader2, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

const HOVER_LIFT = { y: -3 };
const TAP_SOFT = { scale: 0.995 };
const TRANSITION_FAST = { duration: 0.2, ease: 'easeOut' };

const RecoveryTab = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const refresh = async () => {
    setLoading(true);
    const { data: payments, error } = await supabase
      .from('billing_payments')
      .select('id,user_id,payment_status,price_amount,price_currency,provider_invoice_number,provider_invoice_url,created_at,paid_at')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) {
      setRows([]);
      setLoading(false);
      return;
    }
    const userIds = [...new Set((payments || []).map((r) => r.user_id).filter(Boolean))];
    let profileMap = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id,name,email').in('id', userIds);
      profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    }

    const normalized = (payments || []).map((p) => {
      const total = Number(p.price_amount || 0);
      const statusRaw = String(p.payment_status || '').toLowerCase();
      const paid = statusRaw === 'confirmed' ? total : 0;
      const pending = Math.max(0, total - paid);
      const dueDate = new Date(p.created_at || Date.now());
      dueDate.setDate(dueDate.getDate() + 30);
      const status = statusRaw === 'confirmed' ? 'paid' : ['pending', 'confirming'].includes(statusRaw) ? 'pending' : 'overdue';
      return {
        id: p.id,
        invoiceNumber: p.provider_invoice_number || `INV-${String(p.id).slice(0, 8).toUpperCase()}`,
        invoiceUrl: p.provider_invoice_url || null,
        studentName: profileMap[p.user_id]?.name || profileMap[p.user_id]?.email || p.user_id,
        totalAmount: total,
        paidAmount: paid,
        pendingAmount: pending,
        dueDate: dueDate.toISOString(),
        status,
        createdAt: p.created_at,
      };
    });
    const dedupedByInvoice = [];
    const seen = new Set();
    normalized.forEach((row) => {
      const key = String(row.invoiceNumber || row.id);
      if (seen.has(key)) return;
      seen.add(key);
      dedupedByInvoice.push(row);
    });
    setRows(dedupedByInvoice);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filteredData = useMemo(() => {
    return (rows || []).filter((inv) =>
      inv.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [rows, searchTerm]);

  const stats = useMemo(() => {
    const totalAmount = rows.reduce((acc, i) => acc + i.totalAmount, 0);
    const recovered = rows.reduce((acc, i) => acc + i.paidAmount, 0);
    const pending = rows.reduce((acc, i) => acc + i.pendingAmount, 0);
    const recoveryRate = totalAmount > 0 ? (recovered / totalAmount) * 100 : 0;
    
    return { totalAmount, recovered, pending, recoveryRate };
  }, [rows]);

  const statusData = [
    { name: 'Payé', value: rows.filter(i => i.status === 'paid').length },
    { name: 'En attente', value: rows.filter(i => i.status === 'pending').length },
    { name: 'En retard', value: rows.filter(i => i.status === 'overdue').length }
  ];

  const COLORS = ['#4ade80', '#D4AF37', '#f87171'];
  const showSkeleton = loading && rows.length === 0;

  return (
    <div className="space-y-6">
       <motion.div
         initial={{ opacity: 0, y: -8 }}
         animate={{ opacity: 1, y: 0 }}
        transition={TRANSITION_FAST}
         className="flex justify-between items-center"
       >
        <div>
           <h2 className="text-2xl font-bold text-white flex items-center gap-2">
             <FileText className="text-[#D4AF37]" /> Recouvrement
           </h2>
           <p className="text-gray-400 text-sm">Source: paiements et factures provider (Supabase)</p>
        </div>
        <div className="flex gap-2">
           <Button
             onClick={() => void refresh()}
             variant="outline"
             className="border-white/10 text-white hover:bg-white/5 transition-all duration-200"
           >
             <RefreshCw className="w-4 h-4 mr-2"/> Actualiser
           </Button>
        </div>
      </motion.div>

      {showSkeleton ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-[104px] rounded-xl bg-white/10 animate-pulse" />
            <div className="h-[104px] rounded-xl bg-white/10 animate-pulse" />
            <div className="h-[104px] rounded-xl bg-white/10 animate-pulse" />
            <div className="h-[104px] rounded-xl bg-white/10 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-80 rounded-xl bg-white/10 animate-pulse" />
            <div className="lg:col-span-2 h-80 rounded-xl bg-white/10 animate-pulse" />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div whileHover={HOVER_LIFT} whileTap={TAP_SOFT} transition={TRANSITION_FAST}>
            <Card className="premium-panel border-white/10 hover:border-[#D4AF37]/30 transition-all">
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-gray-400 text-xs uppercase">Montant Total</p>
                <p className="text-2xl font-bold text-white">{stats.totalAmount.toLocaleString()} EUR</p>
              </CardContent>
            </Card>
            </motion.div>
            <motion.div whileHover={HOVER_LIFT} whileTap={TAP_SOFT} transition={TRANSITION_FAST}>
            <Card className="premium-panel border-white/10 hover:border-[#D4AF37]/30 transition-all">
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-gray-400 text-xs uppercase">Recouvré</p>
                <p className="text-2xl font-bold text-green-400">{stats.recovered.toLocaleString()} EUR</p>
              </CardContent>
            </Card>
            </motion.div>
            <motion.div whileHover={HOVER_LIFT} whileTap={TAP_SOFT} transition={TRANSITION_FAST}>
            <Card className="premium-panel border-white/10 hover:border-[#D4AF37]/30 transition-all">
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-gray-400 text-xs uppercase">Reste à payer</p>
                <p className="text-2xl font-bold text-red-400">{stats.pending.toLocaleString()} EUR</p>
              </CardContent>
            </Card>
            </motion.div>
            <motion.div whileHover={HOVER_LIFT} whileTap={TAP_SOFT} transition={TRANSITION_FAST}>
            <Card className="premium-panel border-white/10 hover:border-[#D4AF37]/30 transition-all">
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-gray-400 text-xs uppercase">Taux Recouvrement</p>
                <p className="text-2xl font-bold text-[#D4AF37]">{stats.recoveryRate.toFixed(1)}%</p>
              </CardContent>
            </Card>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="premium-panel border-white/10 p-4 lg:col-span-1">
              <h3 className="text-white font-bold mb-4">Statut des Factures</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      labelLine={false}
                      label={({ value }) => (value > 0 ? value : '')}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0F1419', borderColor: '#333', color: '#fff' }} />
                    <Legend wrapperStyle={{ color: '#e5e7eb', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="premium-panel border-white/10 lg:col-span-2">
              <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <Input placeholder="Rechercher facture..." className="pl-8 bg-[#0F1419] border-white/10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {loading ? (
                  <div className="p-8 flex items-center justify-center text-gray-400"><Loader2 className="w-4 h-4 mr-2 animate-spin" />Chargement...</div>
                ) : null}
                <Table>
                  <TableHeader className="bg-[#0F1419]">
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-gray-400">N° Facture</TableHead>
                      <TableHead className="text-gray-400">Étudiant</TableHead>
                      <TableHead className="text-gray-400">Total</TableHead>
                      <TableHead className="text-gray-400">Reste</TableHead>
                      <TableHead className="text-gray-400">Échéance</TableHead>
                      <TableHead className="text-gray-400">Statut</TableHead>
                      <TableHead className="text-right text-gray-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!loading && filteredData.length === 0 ? (
                      <TableRow className="border-white/5">
                        <TableCell colSpan={7} className="text-center py-10 text-gray-400">
                          Aucune facture pour cette recherche.
                        </TableCell>
                      </TableRow>
                    ) : filteredData.map((inv) => (
                      <TableRow key={inv.id} className="border-white/5 hover:bg-white/5">
                        <TableCell className="font-mono text-white text-xs">{inv.invoiceNumber}</TableCell>
                        <TableCell className="text-gray-300 font-medium">{inv.studentName}</TableCell>
                        <TableCell className="text-white">{inv.totalAmount} EUR</TableCell>
                        <TableCell className="text-red-300">{inv.pendingAmount} EUR</TableCell>
                        <TableCell className="text-gray-400 text-xs">{format(new Date(inv.dueDate), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>
                          {inv.status === 'paid' && <Badge className="bg-green-500">Payé</Badge>}
                          {inv.status === 'pending' && <Badge className="bg-yellow-500 text-black">En attente</Badge>}
                          {inv.status === 'overdue' && <Badge variant="destructive">Retard</Badge>}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {inv.invoiceUrl ? (
                            <a href={inv.invoiceUrl} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="ghost" className="h-7 border border-white/10 text-white">Ouvrir</Button>
                            </a>
                          ) : (
                            <span className="text-xs text-gray-500">Pas de lien</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </>
      )}

    </div>
  );
};

export default RecoveryTab;