import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import DataTable from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import { Check, RefreshCw, Download, AlertTriangle } from 'lucide-react';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';

const toCsv = (rows) => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escapeCell = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escapeCell(r[h])).join(','))].join('\n');
};

const PaymentsPage = () => {
  const { toast } = useToast();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const columns = [
    { 
      key: 'payer_name',
      label: 'Client',
      render: (_, row) => row.payer_name || 'Inconnu',
    },
    { 
      key: 'amount', 
      label: 'Montant',
      render: (val, row) => <span className="font-mono font-bold">{val} {row.currency || 'EUR'}</span>
    },
    { 
       key: 'status', 
       label: 'Statut',
       render: (val) => (
         <span className={`px-2 py-1 rounded-full text-xs font-bold ${
           val === 'completed' || val === 'confirmed' ? 'bg-green-500/20 text-green-400' :
           val === 'overdue' || val === 'failed' || val === 'expired' ? 'bg-red-500/20 text-red-400' :
           'bg-yellow-500/20 text-yellow-400'
         }`}>
           {val}
         </span>
       )
    },
    { key: 'provider', label: 'Provider' },
    { key: 'due_date', label: 'Date' },
    { 
       key: 'actions', 
       label: 'Validation',
       render: (_, row) => (
          row.source === 'payments' && row.status !== 'completed' && (
             <Button 
                size="sm" 
                className="bg-green-600 hover:bg-green-700 h-6 px-2 text-xs"
                onClick={() => markAsPaid(row.id)}
             >
                <Check className="w-3 h-3 mr-1" /> Valider
             </Button>
          )
       )
    }
  ];

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);

      // New billing system first
      const { data: billingData, error: billingErr } = await supabase
        .from('billing_invoices')
        .select('id,tenant_id,provider,status,amount_cents,currency,created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      let unified = [];
      if (!billingErr) {
        const userIds = [...new Set((billingData || []).map((p) => p.tenant_id).filter(Boolean))];
        const { data: profileRows } =
          userIds.length > 0
            ? await supabase.from('profiles').select('id,name,email').in('id', userIds)
            : { data: [] };
        const profileMap = Object.fromEntries(
          (profileRows || []).map((p) => [p.id, p.name || p.email || p.id])
        );

        unified = (billingData || []).map((row) => ({
          id: row.id,
          source: 'billing_invoices',
          payer_name: profileMap[row.tenant_id] || row.tenant_id || 'Inconnu',
          amount: Number(row.amount_cents || 0) / 100,
          currency: row.currency || 'EUR',
          status: String(row.status || 'open'),
          provider: row.provider || '—',
          due_date: row.created_at ? new Date(row.created_at).toLocaleString() : '—',
        }));
      }

      // Legacy payments fallback/merge
      const { data: legacyData, error: legacyErr } = await supabase
        .from('payments')
        .select('id,amount,currency,status,due_date,students(profiles(full_name))')
        .order('due_date', { ascending: false })
        .limit(200);
      if (legacyErr && legacyErr.code !== '42P01') throw legacyErr;

      const legacy = (legacyData || []).map((row) => ({
        id: row.id,
        source: 'payments',
        payer_name: row.students?.profiles?.full_name || 'Inconnu',
        amount: Number(row.amount || 0),
        currency: row.currency || 'EUR',
        status: String(row.status || 'pending'),
        provider: 'legacy',
        due_date: row.due_date ? new Date(row.due_date).toLocaleDateString() : '—',
      }));

      setPayments([...unified, ...legacy]);
    } catch (e) {
      setError(e);
      toast({ title: "Erreur", description: "Erreur chargement paiements", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchPayments();
  }, []);

  const markAsPaid = async (id) => {
    try {
       const { error } = await supabase.from('payments').update({ status: 'completed', payment_date: new Date() }).eq('id', id);
       if (error) throw error;
       toast({ title: "Succès", description: "Paiement validé" });
       fetchPayments();
    } catch {
       toast({ title: "Erreur", description: "Opération échouée", variant: "destructive" });
    }
  };

  const filteredPayments = useMemo(() => {
    if (statusFilter === 'all') return payments;
    return payments.filter((p) => String(p.status).toLowerCase() === statusFilter);
  }, [payments, statusFilter]);

  const exportCsv = () => {
    const csv = toCsv(
      filteredPayments.map((p) => ({
        id: p.id,
        source: p.source,
        payer_name: p.payer_name,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        provider: p.provider,
        date: p.due_date,
      }))
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'admin-payments.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const overdueCount = payments.filter((p) => ['overdue', 'failed', 'expired'].includes(String(p.status))).length;

  return (
    <div className="space-y-6">
      <Helmet><title>Gestion Paiements | Admin</title></Helmet>
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
        <h2 className="text-2xl font-bold text-white">Suivi des Paiements</h2>
        <div className="flex items-center gap-2">
          <Button onClick={fetchPayments} variant="outline" className="border-white/10 text-white hover:bg-white/5" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </Button>
          <Button onClick={exportCsv} variant="outline" className="border-white/10 text-white hover:bg-white/5" disabled={filteredPayments.length === 0}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <PremiumSegmentedSelector
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'Tous', badge: 'Global' },
            { value: 'pending', label: 'En attente', badge: 'Flux entrant' },
            { value: 'confirmed', label: 'Confirmés', badge: 'Validés' },
            { value: 'completed', label: 'Complétés', badge: 'Historique' },
            { value: 'failed', label: 'Échoués', badge: 'Anomalies' },
            { value: 'overdue', label: 'Retard', badge: 'Critique' },
          ]}
          layoutId="admin-payments-status-segment-pill"
          className="w-full"
          compact
          showChevron={false}
        />
      </div>

      {error ? (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-300 mt-0.5" />
          <span className="text-red-300 font-medium">{String(error?.message || error)}</span>
        </div>
      ) : null}

      {/* Alerts */}
      <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center justify-between">
         <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-red-300 font-medium">Paiements critiques : {overdueCount}</span>
         </div>
      </div>

      <DataTable 
        columns={columns} 
        data={filteredPayments} 
        searchFields={['status', 'payer_name', 'provider', 'source']}
        actions={false} // Custom actions in column
      />
    </div>
  );
};

export default PaymentsPage;