import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, CreditCard, Check, X, Loader2, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

const HOVER_LIFT = { y: -3 };
const TAP_SOFT = { scale: 0.995 };
const TRANSITION_FAST = { duration: 0.2, ease: 'easeOut' };

const PaymentsTab = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from('billing_invoices')
      .select('id,tenant_id,status,amount_cents,currency,provider,invoice_number,provider_invoice_id,created_at,paid_at')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) {
      setPayments([]);
      setLoading(false);
      return;
    }

    const userIds = [...new Set((rows || []).map((r) => r.tenant_id).filter(Boolean))];
    let profileMap = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id,name,email').in('id', userIds);
      profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    }

    const mapped = (rows || []).map((row) => {
      const p = profileMap[row.tenant_id] || {};
      return {
        ...row,
        reference: row.invoice_number || row.provider_invoice_id || row.id,
        studentName: p.name || p.email || row.tenant_id,
        amount: Number(row.amount_cents || 0) / 100,
      };
    });
    const deduped = [];
    const seenRefs = new Set();
    mapped.forEach((item) => {
      const key = String(item.reference || item.id);
      if (seenRefs.has(key)) return;
      seenRefs.add(key);
      deduped.push(item);
    });
    setPayments(deduped);
    setLastSyncAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const paymentsChannel = supabase
      .channel('owner-payments-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'billing_invoices' }, () => {
        void refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(paymentsChannel);
    };
  }, [refresh]);

  const filteredData = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return (payments || []).filter(
      (pay) => pay.studentName.toLowerCase().includes(q) || String(pay.reference || '').toLowerCase().includes(q)
    );
  }, [payments, searchTerm]);

  const stats = useMemo(() => {
    const total = payments
      .filter((p) => String(p.status || '').toLowerCase() === 'paid')
      .reduce((acc, p) => acc + p.amount, 0);
    const count = payments.length;
    const pending = payments.filter((p) =>
      ['open', 'draft'].includes(String(p.status || '').toLowerCase())
    ).length;
    const confirmedCount = payments.filter((p) => String(p.status || '').toLowerCase() === 'paid').length;
    const totalsByCurrency = payments
      .filter((p) => String(p.status || '').toLowerCase() === 'paid')
      .reduce((acc, p) => {
        const c = String(p.currency || 'EUR').toUpperCase();
        acc[c] = (acc[c] || 0) + Number(p.amount || 0);
        return acc;
      }, {});
    const totalLabel = Object.entries(totalsByCurrency)
      .map(([ccy, value]) => `${Number(value).toLocaleString()} ${ccy}`)
      .join(' • ');
    return { total, count, pending, confirmedCount, totalLabel };
  }, [payments]);

  const methodData = useMemo(() => {
     const acc = {};
     filteredData.forEach((p) => {
       const key = String(p.payment_method || p.provider || 'unknown');
       acc[key] = (acc[key] || 0) + p.amount;
     });
     return Object.keys(acc).map(k => ({ name: k, value: acc[k] }));
  }, [filteredData]);

  const updatePaymentStatus = async (id, nextStatus) => {
    const payload = { status: nextStatus };
    if (nextStatus === 'paid') payload.paid_at = new Date().toISOString();
    await supabase.from('billing_invoices').update(payload).eq('id', id);
    await refresh();
  };

  const showSkeleton = loading && payments.length === 0;

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
             <CreditCard className="text-[#D4AF37]" /> Paiements
           </h2>
           <p className="text-gray-400 text-sm">
             Source: transactions Supabase en temps reel
             {lastSyncAt ? ` • Sync ${lastSyncAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
           </p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div whileHover={HOVER_LIFT} whileTap={TAP_SOFT} transition={TRANSITION_FAST}>
            <Card className="premium-panel border-white/10 hover:border-[#D4AF37]/30 transition-all">
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-gray-400 text-xs uppercase">Total Encaissé</p>
                <p className="text-2xl font-bold text-[#D4AF37]">{stats.totalLabel || `${stats.total.toLocaleString()} EUR`}</p>
              </CardContent>
            </Card>
            </motion.div>
            <motion.div whileHover={HOVER_LIFT} whileTap={TAP_SOFT} transition={TRANSITION_FAST}>
            <Card className="premium-panel border-white/10 hover:border-[#D4AF37]/30 transition-all">
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-gray-400 text-xs uppercase">Nombre Transactions</p>
                <p className="text-2xl font-bold text-white">{stats.count}</p>
                <p className="text-[11px] text-gray-500 mt-1">{stats.confirmedCount} confirmées</p>
              </CardContent>
            </Card>
            </motion.div>
            <motion.div whileHover={HOVER_LIFT} whileTap={TAP_SOFT} transition={TRANSITION_FAST}>
            <Card className="premium-panel border-white/10 hover:border-[#D4AF37]/30 transition-all">
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-gray-400 text-xs uppercase">En Attente</p>
                <p className="text-2xl font-bold text-orange-400">{stats.pending}</p>
              </CardContent>
            </Card>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="premium-panel border-white/10 p-4 lg:col-span-1">
              <h3 className="text-white font-bold mb-4">Volume par Méthode</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={methodData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} stroke="#888" fontSize={12} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#0F1419', borderColor: '#333' }} />
                    <Bar dataKey="value" fill="#D4AF37" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="premium-panel border-white/10 lg:col-span-2">
              <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <Input placeholder="Rechercher paiement..." className="pl-8 bg-[#0F1419] border-white/10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {loading ? (
                  <div className="p-8 flex items-center justify-center text-gray-400"><Loader2 className="w-4 h-4 mr-2 animate-spin" />Chargement...</div>
                ) : null}
                <Table>
                  <TableHeader className="bg-[#0F1419]">
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-gray-400">Référence</TableHead>
                      <TableHead className="text-gray-400">Étudiant</TableHead>
                      <TableHead className="text-gray-400">Montant</TableHead>
                      <TableHead className="text-gray-400">Méthode</TableHead>
                      <TableHead className="text-gray-400">Date</TableHead>
                      <TableHead className="text-gray-400">Statut</TableHead>
                      <TableHead className="text-right text-gray-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!loading && filteredData.length === 0 ? (
                      <TableRow className="border-white/5">
                        <TableCell colSpan={7} className="text-center py-10 text-gray-400">
                          Aucune transaction pour cette recherche.
                        </TableCell>
                      </TableRow>
                    ) : filteredData.map((pay) => (
                      <TableRow key={pay.id} className="border-white/5 hover:bg-white/5">
                        <TableCell className="font-mono text-white text-xs">{pay.reference}</TableCell>
                        <TableCell className="text-gray-300 font-medium">{pay.studentName}</TableCell>
                        <TableCell className="text-[#D4AF37] font-bold">{pay.amount} {pay.currency || 'EUR'}</TableCell>
                        <TableCell className="text-gray-400 text-xs">{pay.provider}</TableCell>
                        <TableCell className="text-gray-400 text-xs">{format(new Date(pay.created_at), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>
                          {String(pay.status || '').toLowerCase() === 'confirmed' && <Badge className="bg-green-500">Confirmé</Badge>}
                          {['pending', 'confirming'].includes(String(pay.status || '').toLowerCase()) && <Badge className="bg-yellow-500 text-black">En attente</Badge>}
                          {['failed', 'expired'].includes(String(pay.status || '').toLowerCase()) && <Badge variant="destructive">Échoué</Badge>}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {['pending', 'confirming'].includes(String(pay.status || '').toLowerCase()) && (
                            <>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-green-400 hover:bg-green-500/20" onClick={() => void updatePaymentStatus(pay.id, 'confirmed')} title="Confirmer">
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:bg-red-500/20" onClick={() => void updatePaymentStatus(pay.id, 'failed')} title="Rejeter">
                                <X className="w-4 h-4" />
                              </Button>
                            </>
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

export default PaymentsTab;