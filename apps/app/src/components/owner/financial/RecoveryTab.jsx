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

/* Thème CLAIR « Wix Studio » — aligné sur OwnerDashboardOverview. */
const LT_TEXT = '#18181B';
const LT_SUB = '#52525B';
const LT_MUTED = '#71717A';
const LT_BORDER = 'rgba(0,0,0,0.08)';
const LT_GOLD_INK = '#8A6D1A';
const cardSurface = {
  background: '#FFFFFF',
  border: `1px solid ${LT_BORDER}`,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const RecoveryTab = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const refresh = async () => {
    setLoading(true);
    const { data: payments, error } = await supabase
      .from('billing_invoices')
      .select('id,tenant_id,status,amount_cents,currency,invoice_number,created_at,paid_at')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) {
      setRows([]);
      setLoading(false);
      return;
    }
    const userIds = [...new Set((payments || []).map((r) => r.tenant_id).filter(Boolean))];
    let profileMap = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id,name,email').in('id', userIds);
      profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    }

    const normalized = (payments || []).map((p) => {
      const total = Number(p.amount_cents || 0) / 100;
      const statusRaw = String(p.status || '').toLowerCase();
      const paid = statusRaw === 'paid' ? total : 0;
      const pending = Math.max(0, total - paid);
      const dueDate = new Date(p.created_at || Date.now());
      dueDate.setDate(dueDate.getDate() + 30);
      const status = statusRaw === 'paid' ? 'paid' : ['open', 'draft'].includes(statusRaw) ? 'pending' : 'overdue';
      return {
        id: p.id,
        invoiceNumber: p.invoice_number || `INV-${String(p.id).slice(0, 8).toUpperCase()}`,
        invoiceUrl: null,
        studentName: profileMap[p.tenant_id]?.name || profileMap[p.tenant_id]?.email || p.tenant_id,
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
           <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: LT_TEXT }}>
             <FileText style={{ color: LT_GOLD_INK }} /> Recouvrement
           </h2>
           <p className="text-sm" style={{ color: LT_SUB }}>Source: paiements et factures provider (Supabase)</p>
        </div>
        <div className="flex gap-2">
           <Button
             onClick={() => void refresh()}
             variant="outline"
             className="bg-white text-zinc-700 border-black/10 hover:bg-zinc-50 transition-all duration-200"
           >
             <RefreshCw className="w-4 h-4 mr-2"/> Actualiser
           </Button>
        </div>
      </motion.div>

      {showSkeleton ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-[104px] rounded-xl bg-black/[0.05] animate-pulse" />
            <div className="h-[104px] rounded-xl bg-black/[0.05] animate-pulse" />
            <div className="h-[104px] rounded-xl bg-black/[0.05] animate-pulse" />
            <div className="h-[104px] rounded-xl bg-black/[0.05] animate-pulse" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-80 rounded-xl bg-black/[0.05] animate-pulse" />
            <div className="lg:col-span-2 h-80 rounded-xl bg-black/[0.05] animate-pulse" />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div whileHover={HOVER_LIFT} whileTap={TAP_SOFT} transition={TRANSITION_FAST}>
            <Card className="border-0 transition-all" style={cardSurface}>
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: LT_MUTED }}>Montant Total</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: LT_TEXT }}>{stats.totalAmount.toLocaleString()} EUR</p>
              </CardContent>
            </Card>
            </motion.div>
            <motion.div whileHover={HOVER_LIFT} whileTap={TAP_SOFT} transition={TRANSITION_FAST}>
            <Card className="border-0 transition-all" style={cardSurface}>
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: LT_MUTED }}>Recouvré</p>
                <p className="text-2xl font-bold tabular-nums text-emerald-600">{stats.recovered.toLocaleString()} EUR</p>
              </CardContent>
            </Card>
            </motion.div>
            <motion.div whileHover={HOVER_LIFT} whileTap={TAP_SOFT} transition={TRANSITION_FAST}>
            <Card className="border-0 transition-all" style={cardSurface}>
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: LT_MUTED }}>Reste à payer</p>
                <p className="text-2xl font-bold tabular-nums text-red-600">{stats.pending.toLocaleString()} EUR</p>
              </CardContent>
            </Card>
            </motion.div>
            <motion.div whileHover={HOVER_LIFT} whileTap={TAP_SOFT} transition={TRANSITION_FAST}>
            <Card className="border-0 transition-all" style={cardSurface}>
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: LT_MUTED }}>Taux Recouvrement</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: LT_GOLD_INK }}>{stats.recoveryRate.toFixed(1)}%</p>
              </CardContent>
            </Card>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="border-0 p-4 lg:col-span-1" style={cardSurface}>
              <h3 className="font-bold mb-4" style={{ color: LT_TEXT }}>Statut des Factures</h3>
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
                    <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '10px', color: '#18181B', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                    <Legend wrapperStyle={{ color: '#52525B', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="border-0 lg:col-span-2" style={cardSurface}>
              <div className="p-4 flex justify-between items-center" style={{ borderBottom: `1px solid ${LT_BORDER}` }}>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4" style={{ color: LT_MUTED }} />
                  <Input placeholder="Rechercher facture..." className="pl-8 bg-[#F4F5F7] border-black/10 text-zinc-900 placeholder:text-zinc-400" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {loading ? (
                  <div className="p-8 flex items-center justify-center" style={{ color: LT_MUTED }}><Loader2 className="w-4 h-4 mr-2 animate-spin" />Chargement...</div>
                ) : null}
                <Table>
                  <TableHeader className="bg-[#F8F8FA]">
                    <TableRow className="border-black/[0.06] hover:bg-transparent">
                      <TableHead className="text-zinc-500">N° Facture</TableHead>
                      <TableHead className="text-zinc-500">Étudiant</TableHead>
                      <TableHead className="text-zinc-500">Total</TableHead>
                      <TableHead className="text-zinc-500">Reste</TableHead>
                      <TableHead className="text-zinc-500">Échéance</TableHead>
                      <TableHead className="text-zinc-500">Statut</TableHead>
                      <TableHead className="text-right text-zinc-500">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!loading && filteredData.length === 0 ? (
                      <TableRow className="border-black/[0.06]">
                        <TableCell colSpan={7} className="text-center py-10" style={{ color: LT_MUTED }}>
                          Aucune facture pour cette recherche.
                        </TableCell>
                      </TableRow>
                    ) : filteredData.map((inv) => (
                      <TableRow key={inv.id} className="border-black/[0.06] hover:bg-zinc-50">
                        <TableCell className="font-mono text-xs" style={{ color: LT_TEXT }}>{inv.invoiceNumber}</TableCell>
                        <TableCell className="font-medium" style={{ color: LT_TEXT }}>{inv.studentName}</TableCell>
                        <TableCell style={{ color: LT_TEXT }}>{inv.totalAmount} EUR</TableCell>
                        <TableCell className="text-red-600">{inv.pendingAmount} EUR</TableCell>
                        <TableCell className="text-xs" style={{ color: LT_SUB }}>{format(new Date(inv.dueDate), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>
                          {inv.status === 'paid' && <Badge className="bg-green-500">Payé</Badge>}
                          {inv.status === 'pending' && <Badge className="bg-yellow-500 text-black">En attente</Badge>}
                          {inv.status === 'overdue' && <Badge variant="destructive">Retard</Badge>}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {inv.invoiceUrl ? (
                            <a href={inv.invoiceUrl} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="ghost" className="h-7 border border-black/10 text-zinc-700 hover:bg-zinc-50">Ouvrir</Button>
                            </a>
                          ) : (
                            <span className="text-xs" style={{ color: LT_MUTED }}>Pas de lien</span>
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