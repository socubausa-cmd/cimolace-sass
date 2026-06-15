import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CreditCard,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Search,
  Download,
  Users,
  TrendingUp,
  Ban,
  Filter,
  Mail,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  active:    { label: 'À jour',          color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle,    iconColor: 'text-emerald-600' },
  past_due:  { label: 'Retard',          color: 'bg-red-50 text-red-700 border-red-200',            icon: AlertTriangle,  iconColor: 'text-red-600' },
  expired:   { label: 'Expiré',          color: 'bg-orange-50 text-orange-700 border-orange-200',   icon: XCircle,        iconColor: 'text-orange-600' },
  pending:   { label: 'En attente',      color: 'bg-amber-50 text-amber-700 border-amber-200',      icon: Clock,          iconColor: 'text-amber-600' },
  canceled:  { label: 'Annulé',          color: 'bg-zinc-100 text-zinc-600 border-zinc-200',         icon: Ban,            iconColor: 'text-zinc-500' },
  no_sub:    { label: 'Pas d\'abonnement', color: 'bg-zinc-100 text-zinc-500 border-zinc-200',       icon: Users,          iconColor: 'text-zinc-400' },
};

const PAYMENT_STATUS_CONFIG = {
  confirmed:       { label: 'Confirmé',      color: 'text-emerald-600' },
  partially_paid:  { label: 'Partiel',       color: 'text-amber-600' },
  confirming:      { label: 'En cours',      color: 'text-blue-600' },
  pending:         { label: 'En attente',    color: 'text-yellow-600' },
  expired:         { label: 'Expiré',        color: 'text-orange-600' },
  failed:          { label: 'Échoué',        color: 'text-red-600' },
  refunded:        { label: 'Remboursé',     color: 'text-purple-600' },
};

const FILTER_OPTIONS = [
  { value: 'all',      label: 'Tous' },
  { value: 'active',   label: 'À jour' },
  { value: 'past_due', label: 'En retard' },
  { value: 'expired',  label: 'Expirés' },
  { value: 'pending',  label: 'En attente' },
  { value: 'no_sub',   label: 'Sans abonnement' },
];

export default function SecretariatBillingPanel() {
  const { supabase, session } = useAuth();
  const { toast } = useToast();

  const [students, setStudents]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState('all');
  const [selected, setSelected]     = useState(null); // student detail modal
  const [studentPayments, setStudentPayments] = useState([]);
  const [detailLoading, setDetailLoading]     = useState(false);
  const [resendPaymentId, setResendPaymentId]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 1. All students
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id,name,email,avatar_url,phone')
        .eq('role', 'student')
        .order('name')
        .limit(500);

      if (!profiles?.length) {
        setStudents([]);
        return;
      }

      const ids = profiles.map((p) => p.id);

      // 2. Latest subscription per student
      const { data: subs } = await supabase
        .from('billing_subscriptions')
        .select('id,user_id,plan_id,status,current_period_start,current_period_end')
        .in('user_id', ids)
        .order('created_at', { ascending: false })
        .limit(2000);

      // Build subMap and prepare sub→user reverse mapping for invoice lookup
      const subMap = {};
      const subIdToUserId = {};
      (subs || []).forEach((s) => {
        if (!subMap[s.user_id]) subMap[s.user_id] = s;
        if (s.id) subIdToUserId[s.id] = s.user_id;
      });

      // 3. Latest confirmed payment per student via subscription_id
      // billing_invoices.tenant_id → tenants.id (platform UUID), not profile IDs.
      // We must join through billing_subscriptions.id instead.
      const allSubIds = Object.keys(subIdToUserId);
      const { data: payments } = allSubIds.length > 0
        ? await supabase
            .from('billing_invoices')
            .select('id,subscription_id,status,amount_cents,currency,created_at')
            .in('subscription_id', allSubIds)
            .order('created_at', { ascending: false })
            .limit(2000)
        : { data: [] };

      const payMap = {};
      (payments || []).forEach((p) => {
        const uid = subIdToUserId[p.subscription_id];
        if (uid && !payMap[uid]) payMap[uid] = p;
      });

      const merged = profiles.map((p) => ({
        ...p,
        subscription: subMap[p.id] || null,
        lastPayment:  payMap[p.id] || null,
        subStatus:    subMap[p.id]?.status || 'no_sub',
      }));

      setStudents(merged);
    } catch (err) {
      toast({ title: 'Erreur de chargement', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [supabase, toast]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (student) => {
    setSelected(student);
    setDetailLoading(true);
    // Resolve all subscription IDs for this student, then fetch invoices by subscription_id.
    // billing_invoices.tenant_id → tenants.id (platform UUID), not student profile IDs.
    const { data: studentSubs } = await supabase
      .from('billing_subscriptions').select('id').eq('user_id', student.id);
    const studentSubIds = (studentSubs || []).map(s => s.id);
    const { data } = studentSubIds.length > 0
      ? await supabase
          .from('billing_invoices')
          .select('id,status,amount_cents,currency,created_at,provider,invoice_number,provider_invoice_id,paid_at')
          .in('subscription_id', studentSubIds)
          .order('created_at', { ascending: false })
          .limit(20)
      : { data: [] };
    setStudentPayments(data || []);
    setDetailLoading(false);
  };

  const resendInvoiceForPayment = async (paymentId) => {
    if (!session?.access_token || !paymentId) return;
    setResendPaymentId(paymentId);
    try {
      const res = await fetch('/.netlify/functions/billing-resend-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ paymentId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: 'Renvoi impossible',
          description: body.error || res.statusText,
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Facture renvoyée',
        description: body.invoiceNumber ? `E-mail envoyé (${body.invoiceNumber}).` : 'E-mail envoyé à l\'élève.',
      });
      if (selected) await openDetail(selected);
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    } finally {
      setResendPaymentId(null);
    }
  };

  const stats = {
    total:    students.length,
    active:   students.filter((s) => s.subStatus === 'active').length,
    past_due: students.filter((s) => s.subStatus === 'past_due').length,
    expired:  students.filter((s) => s.subStatus === 'expired').length,
    no_sub:   students.filter((s) => s.subStatus === 'no_sub').length,
  };

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q);
    const matchFilter = filter === 'all' || s.subStatus === filter;
    return matchSearch && matchFilter;
  });

  const handleExport = () => {
    const rows = [
      ['Nom', 'Email', 'Statut abonnement', 'Plan', 'Expire le', 'Dernier paiement', 'Montant', 'Statut paiement'],
      ...filtered.map((s) => [
        s.name || '',
        s.email || '',
        STATUS_CONFIG[s.subStatus]?.label || s.subStatus,
        s.subscription?.plan_id || '—',
        s.subscription?.current_period_end ? format(new Date(s.subscription.current_period_end), 'dd/MM/yyyy') : '—',
        s.lastPayment?.created_at ? format(new Date(s.lastPayment.created_at), 'dd/MM/yyyy') : '—',
        s.lastPayment ? `${(s.lastPayment.amount_cents / 100).toFixed(0)} ${s.lastPayment.currency || ''}` : '—',
        s.lastPayment ? (PAYMENT_STATUS_CONFIG[s.lastPayment.status]?.label || s.lastPayment.status) : '—',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paiements-etudiants-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[14px] border border-black/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div>
          <h1 className="text-2xl font-bold text-[#18181B] flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-[#8A6D1A]" /> Suivi des paiements
          </h1>
          <p className="text-[#52525B] text-sm mt-1">
            Vue complète de qui a payé, qui est en retard, et qui n'a pas d\'abonnement.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <Button variant="outline" onClick={load} disabled={loading} className="border-black/[0.08] bg-white text-[#18181B] hover:bg-[#F4F5F7] w-full sm:w-auto">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </Button>
          <Button onClick={handleExport} className="bg-[var(--school-accent)] text-black hover:bg-amber-500 font-bold w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" /> Exporter CSV
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {[
          { label: 'Total étudiants', value: stats.total,    color: 'text-blue-600' },
          { label: 'À jour',          value: stats.active,   color: 'text-emerald-600' },
          { label: 'En retard',       value: stats.past_due, color: 'text-red-600' },
          { label: 'Expirés',         value: stats.expired,  color: 'text-orange-600' },
          { label: 'Sans abonnement', value: stats.no_sub,   color: 'text-zinc-500' },
        ].map((s, i) => (
          <Card key={i} className="bg-white border-black/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-[#52525B] mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters & search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]" />
          <Input
            placeholder="Rechercher par nom ou email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white border-black/[0.08] text-[#18181B] placeholder:text-[#71717A]"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-[#71717A] shrink-0" />
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                filter === opt.value
                  ? 'bg-[var(--school-accent)] text-black border-[var(--school-accent)]'
                  : 'bg-white text-[#52525B] border-black/[0.08] hover:border-black/20'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="bg-white border-black/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-[#18181B] text-base">
            {filtered.length} étudiant{filtered.length !== 1 ? 's' : ''}
            {filter !== 'all' && ` · Filtre: ${FILTER_OPTIONS.find((o) => o.value === filter)?.label}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-[#52525B]">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-[#71717A]">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-25" />
              <p>Aucun étudiant trouvé.</p>
            </div>
          ) : (
            <>
            <div className="space-y-2 p-3 lg:hidden">
              {filtered.map((student) => {
                const sc = STATUS_CONFIG[student.subStatus] || STATUS_CONFIG.no_sub;
                const Icon = sc.icon;
                const pc = student.lastPayment ? (PAYMENT_STATUS_CONFIG[student.lastPayment.status] || {}) : null;
                const expAt = student.subscription?.current_period_end;
                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => openDetail(student)}
                    className="w-full rounded-xl border border-black/[0.08] bg-[#F4F5F7] p-4 text-left transition-colors active:bg-black/[0.04]"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarImage src={student.avatar_url} />
                        <AvatarFallback className="bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[#8A6D1A] text-xs">
                          {(student.name || student.email || '?')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div>
                          <p className="text-[#18181B] font-medium leading-tight truncate">{student.name || '—'}</p>
                          <p className="text-[#71717A] text-xs truncate">{student.email}</p>
                        </div>
                        <Badge className={cn('border text-xs', sc.color)}>
                          <Icon className={cn('w-3 h-3 mr-1', sc.iconColor)} />
                          {sc.label}
                        </Badge>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#52525B]">
                          <span className="truncate max-w-full">
                            Plan : {student.subscription?.plan_id || '—'}
                          </span>
                          {expAt ? (
                            <span>{format(new Date(expAt), 'dd/MM/yyyy')}</span>
                          ) : null}
                          {student.lastPayment?.created_at ? (
                            <span>
                              {formatDistanceToNow(new Date(student.lastPayment.created_at), { addSuffix: true, locale: fr })}
                            </span>
                          ) : (
                            <span className="text-[#71717A]">Jamais payé</span>
                          )}
                          {pc ? <span className={pc.color}>{pc.label}</span> : null}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-[#71717A] uppercase bg-[#F4F5F7]">
                  <tr>
                    <th className="px-4 py-3">Étudiant</th>
                    <th className="px-4 py-3">Statut abonnement</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Expire le</th>
                    <th className="px-4 py-3">Dernier paiement</th>
                    <th className="px-4 py-3">Montant</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((student) => {
                    const sc    = STATUS_CONFIG[student.subStatus] || STATUS_CONFIG.no_sub;
                    const Icon  = sc.icon;
                    const pc    = student.lastPayment ? (PAYMENT_STATUS_CONFIG[student.lastPayment.status] || {}) : null;
                    const expAt = student.subscription?.current_period_end;
                    const isExpiringSoon = expAt && new Date(expAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) && new Date(expAt) > new Date();

                    return (
                      <tr
                        key={student.id}
                        className="border-b border-black/[0.06] hover:bg-[#F4F5F7] cursor-pointer transition-colors"
                        onClick={() => openDetail(student)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={student.avatar_url} />
                              <AvatarFallback className="bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[#8A6D1A] text-xs">
                                {(student.name || student.email || '?')[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-[#18181B] font-medium leading-tight">{student.name || '—'}</p>
                              <p className="text-[#71717A] text-xs">{student.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`border text-xs ${sc.color}`}>
                            <Icon className={`w-3 h-3 mr-1 ${sc.iconColor}`} />
                            {sc.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-[#52525B]">
                          {student.subscription?.plan_id || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {expAt ? (
                            <span className={isExpiringSoon ? 'text-amber-600 font-medium' : 'text-[#52525B]'}>
                              {format(new Date(expAt), 'dd/MM/yyyy')}
                              {isExpiringSoon && <span className="ml-1 text-xs">(bientôt)</span>}
                            </span>
                          ) : (
                            <span className="text-[#71717A]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#52525B] text-xs">
                          {student.lastPayment?.created_at
                            ? formatDistanceToNow(new Date(student.lastPayment.created_at), { addSuffix: true, locale: fr })
                            : <span className="text-[#71717A]">Jamais payé</span>}
                        </td>
                        <td className="px-4 py-3">
                          {student.lastPayment ? (
                            <div>
                              <span className="text-[#18181B] font-medium">
                                  {(student.lastPayment.amount_cents / 100).toFixed(0)} {student.lastPayment.currency || ''}
                              </span>
                              {pc && <p className={`text-xs ${pc.color}`}>{pc.label}</p>}
                            </div>
                          ) : (
                            <span className="text-[#71717A]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-[#8A6D1A] hover:bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] text-xs h-7 px-2"
                            onClick={(e) => { e.stopPropagation(); openDetail(student); }}
                          >
                            Détails →
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail panel (slide-in overlay) */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[2px]" onClick={() => setSelected(null)}>
          <div
            className="h-full w-full max-lg:max-w-none max-w-md bg-[#F4F5F7] border-l border-black/[0.08] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-black/[0.08] flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={selected.avatar_url} />
                  <AvatarFallback className="bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[#8A6D1A]">
                    {(selected.name || selected.email || '?')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-[#18181B] font-bold">{selected.name || '—'}</p>
                  <p className="text-[#52525B] text-xs">{selected.email}</p>
                  {selected.phone && <p className="text-[#71717A] text-xs">{selected.phone}</p>}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-[#71717A] hover:text-[#18181B] p-1">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Subscription summary */}
            <div className="p-4 border-b border-black/[0.08]">
              <h3 className="text-[#71717A] text-xs uppercase tracking-wider mb-3">Abonnement actuel</h3>
              {selected.subscription ? (
                <div className="bg-white border border-black/[0.08] rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[#52525B] text-sm">Statut</span>
                    <Badge className={`border text-xs ${STATUS_CONFIG[selected.subStatus]?.color}`}>
                      {STATUS_CONFIG[selected.subStatus]?.label}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#52525B] text-sm">Plan</span>
                    <span className="text-[#18181B] text-sm font-medium">{selected.subscription.plan_id || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#52525B] text-sm">Prix</span>
                    <span className="text-[#71717A] text-sm">—</span>
                  </div>
                  {selected.subscription.current_period_start && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#52525B] text-sm">Démarré le</span>
                      <span className="text-[#52525B] text-sm">{format(new Date(selected.subscription.current_period_start), 'dd MMM yyyy', { locale: fr })}</span>
                    </div>
                  )}
                  {selected.subscription.current_period_end && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#52525B] text-sm">Expire le</span>
                      <span className={`text-sm font-medium ${new Date(selected.subscription.current_period_end) < new Date() ? 'text-red-600' : 'text-emerald-600'}`}>
                        {format(new Date(selected.subscription.current_period_end), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-black/[0.08] rounded-lg p-3 text-center text-[#71717A] text-sm">
                  Aucun abonnement enregistré
                </div>
              )}
            </div>

            {/* Payment history */}
            <div className="flex-1 overflow-hidden flex flex-col p-4">
              <h3 className="text-[#71717A] text-xs uppercase tracking-wider mb-3">Historique des paiements</h3>
              {detailLoading ? (
                <div className="flex items-center justify-center py-8 text-[#52525B]">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
                </div>
              ) : (
                <ScrollArea className="flex-1">
                  {studentPayments.length === 0 ? (
                    <div className="text-center py-8 text-[#71717A]">
                      <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-25" />
                      <p className="text-sm">Aucun paiement enregistré</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {studentPayments.map((pay) => {
                        const ps = PAYMENT_STATUS_CONFIG[pay.payment_status] || { label: pay.payment_status, color: 'text-[#52525B]' };
                        const isConfirmed = String(pay.payment_status || '').toLowerCase() === 'confirmed';
                        const notSentBySchool = isConfirmed && !pay.invoice_sent_at;
                        const studentReported = isConfirmed && pay.invoice_student_not_received_at;
                        return (
                          <div key={pay.id} className="bg-white border border-black/[0.08] rounded-lg p-3 flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-[#18181B] text-sm font-medium">
                                  {(Number(pay.amount_cents || 0) / 100).toFixed(0)} {pay.currency || 'XAF'}
                                </p>
                                <p className="text-[#71717A] text-xs">
                                  {pay.provider || '—'}
                                </p>
                                <p className="text-[#71717A] text-xs">
                                  {format(new Date(pay.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                                </p>
                              </div>
                              <span className={`text-xs font-semibold shrink-0 ${ps.color}`}>{ps.label}</span>
                            </div>
                            {isConfirmed ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {notSentBySchool ? (
                                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                                    Facture e-mail non envoyée
                                  </Badge>
                                ) : (
                                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                                    Facture envoyée
                                  </Badge>
                                )}
                                {studentReported ? (
                                  <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-[10px]">
                                    Élève : pas reçue
                                  </Badge>
                                ) : null}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px] border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] text-[#8A6D1A] hover:bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)]"
                                  disabled={!session?.access_token || resendPaymentId === pay.id}
                                  onClick={() => resendInvoiceForPayment(pay.id)}
                                >
                                  <Mail className="w-3 h-3 mr-1" />
                                  {resendPaymentId === pay.id ? 'Envoi…' : 'Renvoyer facture'}
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
