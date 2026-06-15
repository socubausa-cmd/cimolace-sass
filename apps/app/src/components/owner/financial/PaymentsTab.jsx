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

/* Thème CLAIR « Wix Studio » — aligné sur OwnerDashboardOverview. */
const LT_TEXT = '#18181B';
const LT_SUB = '#52525B';
const LT_MUTED = '#71717A';
const LT_BORDER = 'rgba(0,0,0,0.08)';
const LT_GOLD_INK = '#8A6D1A'; // or lisible AA sur blanc
const cardSurface = {
  background: '#FFFFFF',
  border: `1px solid ${LT_BORDER}`,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

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
           <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: LT_TEXT }}>
             <CreditCard style={{ color: LT_GOLD_INK }} /> Paiements
           </h2>
           <p className="text-sm" style={{ color: LT_SUB }}>
             Source: transactions Supabase en temps reel
             {lastSyncAt ? ` • Sync ${lastSyncAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
           </p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div whileHover={HOVER_LIFT} whileTap={TAP_SOFT} transition={TRANSITION_FAST}>
            <Card className="border-0 transition-all" style={cardSurface}>
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: LT_MUTED }}>Total Encaissé</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: LT_GOLD_INK }}>{stats.totalLabel || `${stats.total.toLocaleString()} EUR`}</p>
              </CardContent>
            </Card>
            </motion.div>
            <motion.div whileHover={HOVER_LIFT} whileTap={TAP_SOFT} transition={TRANSITION_FAST}>
            <Card className="border-0 transition-all" style={cardSurface}>
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: LT_MUTED }}>Nombre Transactions</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: LT_TEXT }}>{stats.count}</p>
                <p className="text-[11px] mt-1" style={{ color: LT_MUTED }}>{stats.confirmedCount} confirmées</p>
              </CardContent>
            </Card>
            </motion.div>
            <motion.div whileHover={HOVER_LIFT} whileTap={TAP_SOFT} transition={TRANSITION_FAST}>
            <Card className="border-0 transition-all" style={cardSurface}>
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: LT_MUTED }}>En Attente</p>
                <p className="text-2xl font-bold tabular-nums text-amber-600">{stats.pending}</p>
              </CardContent>
            </Card>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="border-0 p-4 lg:col-span-1" style={cardSurface}>
              <h3 className="font-bold mb-4" style={{ color: LT_TEXT }}>Volume par Méthode</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={methodData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} stroke="#71717A" fontSize={12} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '10px', color: '#18181B', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                    <Bar dataKey="value" fill="#D4AF37" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="border-0 lg:col-span-2" style={cardSurface}>
              <div className="p-4 flex justify-between items-center" style={{ borderBottom: `1px solid ${LT_BORDER}` }}>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4" style={{ color: LT_MUTED }} />
                  <Input placeholder="Rechercher paiement..." className="pl-8 bg-[#F4F5F7] border-black/10 text-zinc-900 placeholder:text-zinc-400" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {loading ? (
                  <div className="p-8 flex items-center justify-center" style={{ color: LT_MUTED }}><Loader2 className="w-4 h-4 mr-2 animate-spin" />Chargement...</div>
                ) : null}
                <Table>
                  <TableHeader className="bg-[#F8F8FA]">
                    <TableRow className="border-black/[0.06] hover:bg-transparent">
                      <TableHead className="text-zinc-500">Référence</TableHead>
                      <TableHead className="text-zinc-500">Étudiant</TableHead>
                      <TableHead className="text-zinc-500">Montant</TableHead>
                      <TableHead className="text-zinc-500">Méthode</TableHead>
                      <TableHead className="text-zinc-500">Date</TableHead>
                      <TableHead className="text-zinc-500">Statut</TableHead>
                      <TableHead className="text-right text-zinc-500">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!loading && filteredData.length === 0 ? (
                      <TableRow className="border-black/[0.06]">
                        <TableCell colSpan={7} className="text-center py-10" style={{ color: LT_MUTED }}>
                          Aucune transaction pour cette recherche.
                        </TableCell>
                      </TableRow>
                    ) : filteredData.map((pay) => (
                      <TableRow key={pay.id} className="border-black/[0.06] hover:bg-zinc-50">
                        <TableCell className="font-mono text-xs" style={{ color: LT_TEXT }}>{pay.reference}</TableCell>
                        <TableCell className="font-medium" style={{ color: LT_TEXT }}>{pay.studentName}</TableCell>
                        <TableCell className="font-bold" style={{ color: LT_GOLD_INK }}>{pay.amount} {pay.currency || 'EUR'}</TableCell>
                        <TableCell className="text-xs" style={{ color: LT_SUB }}>{pay.provider}</TableCell>
                        <TableCell className="text-xs" style={{ color: LT_SUB }}>{format(new Date(pay.created_at), 'dd/MM/yyyy')}</TableCell>
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