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
  active:    { label: 'À jour',          color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: CheckCircle,    iconColor: 'text-emerald-400' },
  past_due:  { label: 'Retard',          color: 'bg-red-500/20 text-red-300 border-red-500/30',            icon: AlertTriangle,  iconColor: 'text-red-400' },
  expired:   { label: 'Expiré',          color: 'bg-orange-500/20 text-orange-300 border-orange-500/30',   icon: XCircle,        iconColor: 'text-orange-400' },
  pending:   { label: 'En attente',      color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',      icon: Clock,          iconColor: 'text-amber-400' },
  canceled:  { label: 'Annulé',          color: 'bg-gray-500/20 text-gray-300 border-gray-500/30',         icon: Ban,            iconColor: 'text-gray-400' },
  no_sub:    { label: 'Pas d\'abonnement', color: 'bg-gray-600/20 text-gray-400 border-gray-600/30',       icon: Users,          iconColor: 'text-gray-500' },
};

const PAYMENT_STATUS_CONFIG = {
  confirmed:       { label: 'Confirmé',      color: 'text-emerald-400' },
  partially_paid:  { label: 'Partiel',       color: 'text-amber-400' },
  confirming:      { label: 'En cours',      color: 'text-blue-400' },
  pending:         { label: 'En attente',    color: 'text-yellow-400' },
  expired:         { label: 'Expiré',        color: 'text-orange-400' },
  failed:          { label: 'Échoué',        color: 'text-red-400' },
  refunded:        { label: 'Remboursé',     color: 'text-purple-400' },
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
        .select('id,user_id,status,expires_at,started_at,billing_plans(name,price_amount,price_currency,interval_type)')
        .in('user_id', ids)
        .order('created_at', { ascending: false })
        .limit(2000);

      // 3. Latest confirmed payment per student
      const { data: payments } = await supabase
        .from('billing_payments')
        .select('id,user_id,payment_status,price_amount,price_currency,created_at,billing_plans(name)')
        .in('user_id', ids)
        .order('created_at', { ascending: false })
        .limit(2000);

      // Build maps: keep only the latest subscription and payment per user
      const subMap = {};
      (subs || []).forEach((s) => {
        if (!subMap[s.user_id]) subMap[s.user_id] = s;
      });
      const payMap = {};
      (payments || []).forEach((p) => {
        if (!payMap[p.user_id]) payMap[p.user_id] = p;
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
    const { data } = await supabase
      .from('billing_payments')
      .select(
        'id,payment_status,price_amount,price_currency,created_at,billing_plans(name,interval_type),provider,payment_method,invoice_sent_at,invoice_student_not_received_at,invoice_last_emailed_at'
      )
      .eq('user_id', student.id)
      .order('created_at', { ascending: false })
      .limit(20);
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
        description: body.invoiceNumber ? `E-mail envoyé (${body.invoiceNumber}).` : 'E-mail envoyé à l’élève.',
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
        s.subscription?.billing_plans?.name || '—',
        s.subscription?.expires_at ? format(new Date(s.subscription.expires_at), 'dd/MM/yyyy') : '—',
        s.lastPayment?.created_at ? format(new Date(s.lastPayment.created_at), 'dd/MM/yyyy') : '—',
        s.lastPayment ? `${s.lastPayment.price_amount} ${s.lastPayment.price_currency}` : '—',
        s.lastPayment ? (PAYMENT_STATUS_CONFIG[s.lastPayment.payment_status]?.label || s.lastPayment.payment_status) : '—',
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#192734] p-6 rounded-xl border border-white/10">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-[#D4AF37]" /> Suivi des paiements
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Vue complète de qui a payé, qui est en retard, et qui n'a pas d'abonnement.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <Button variant="outline" onClick={load} disabled={loading} className="border-white/10 text-white hover:bg-white/5 w-full sm:w-auto">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </Button>
          <Button onClick={handleExport} className="bg-[#D4AF37] text-black hover:bg-amber-500 font-bold w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" /> Exporter CSV
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {[
          { label: 'Total étudiants', value: stats.total,    color: 'text-blue-400',    bg: 'bg-blue-500/10' },
          { label: 'À jour',          value: stats.active,   color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'En retard',       value: stats.past_due, color: 'text-red-400',     bg: 'bg-red-500/10' },
          { label: 'Expirés',         value: stats.expired,  color: 'text-orange-400',  bg: 'bg-orange-500/10' },
          { label: 'Sans abonnement', value: stats.no_sub,   color: 'text-gray-400',    bg: 'bg-gray-500/10' },
        ].map((s, i) => (
          <Card key={i} className="bg-[#192734] border-white/10">
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters & search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Rechercher par nom ou email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[#192734] border-white/10 text-white placeholder:text-gray-500"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400 shrink-0" />
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                filter === opt.value
                  ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                  : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/30'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="bg-[#192734] border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-base">
            {filtered.length} étudiant{filtered.length !== 1 ? 's' : ''}
            {filter !== 'all' && ` · Filtre: ${FILTER_OPTIONS.find((o) => o.value === filter)?.label}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p>Aucun étudiant trouvé.</p>
            </div>
          ) : (
            <>
            <div className="space-y-2 p-3 lg:hidden">
              {filtered.map((student) => {
                const sc = STATUS_CONFIG[student.subStatus] || STATUS_CONFIG.no_sub;
                const Icon = sc.icon;
                const pc = student.lastPayment ? (PAYMENT_STATUS_CONFIG[student.lastPayment.payment_status] || {}) : null;
                const expAt = student.subscription?.expires_at;
                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => openDetail(student)}
                    className="w-full rounded-xl border border-white/10 bg-[#0F1419]/90 p-4 text-left transition-colors active:bg-white/5"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarImage src={student.avatar_url} />
                        <AvatarFallback className="bg-[#D4AF37]/20 text-[#D4AF37] text-xs">
                          {(student.name || student.email || '?')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div>
                          <p className="text-white font-medium leading-tight truncate">{student.name || '—'}</p>
                          <p className="text-gray-500 text-xs truncate">{student.email}</p>
                        </div>
                        <Badge className={cn('border text-xs', sc.color)}>
                          <Icon className={cn('w-3 h-3 mr-1', sc.iconColor)} />
                          {sc.label}
                        </Badge>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400">
                          <span className="truncate max-w-full">
                            Plan : {student.subscription?.billing_plans?.name || '—'}
                          </span>
                          {expAt ? (
                            <span>{format(new Date(expAt), 'dd/MM/yyyy')}</span>
                          ) : null}
                          {student.lastPayment?.created_at ? (
                            <span>
                              {formatDistanceToNow(new Date(student.lastPayment.created_at), { addSuffix: true, locale: fr })}
                            </span>
                          ) : (
                            <span className="text-gray-600">Jamais payé</span>
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
                <thead className="text-xs text-gray-500 uppercase bg-[#0F1419]/50">
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
                    const pc    = student.lastPayment ? (PAYMENT_STATUS_CONFIG[student.lastPayment.payment_status] || {}) : null;
                    const expAt = student.subscription?.expires_at;
                    const isExpiringSoon = expAt && new Date(expAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) && new Date(expAt) > new Date();

                    return (
                      <tr
                        key={student.id}
                        className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                        onClick={() => openDetail(student)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={student.avatar_url} />
                              <AvatarFallback className="bg-[#D4AF37]/20 text-[#D4AF37] text-xs">
                                {(student.name || student.email || '?')[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-white font-medium leading-tight">{student.name || '—'}</p>
                              <p className="text-gray-500 text-xs">{student.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`border text-xs ${sc.color}`}>
                            <Icon className={`w-3 h-3 mr-1 ${sc.iconColor}`} />
                            {sc.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {student.subscription?.billing_plans?.name || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {expAt ? (
                            <span className={isExpiringSoon ? 'text-amber-400 font-medium' : 'text-gray-300'}>
                              {format(new Date(expAt), 'dd/MM/yyyy')}
                              {isExpiringSoon && <span className="ml-1 text-xs">(bientôt)</span>}
                            </span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {student.lastPayment?.created_at
                            ? formatDistanceToNow(new Date(student.lastPayment.created_at), { addSuffix: true, locale: fr })
                            : <span className="text-gray-600">Jamais payé</span>}
                        </td>
                        <td className="px-4 py-3">
                          {student.lastPayment ? (
                            <div>
                              <span className="text-white font-medium">
                                {student.lastPayment.price_amount} {student.lastPayment.price_currency}
                              </span>
                              {pc && <p className={`text-xs ${pc.color}`}>{pc.label}</p>}
                            </div>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-[#D4AF37] hover:bg-[#D4AF37]/10 text-xs h-7 px-2"
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
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]" onClick={() => setSelected(null)}>
          <div
            className="h-full w-full max-lg:max-w-none max-w-md bg-[#0F1419] border-l border-white/10 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#192734]">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={selected.avatar_url} />
                  <AvatarFallback className="bg-[#D4AF37]/20 text-[#D4AF37]">
                    {(selected.name || selected.email || '?')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-white font-bold">{selected.name || '—'}</p>
                  <p className="text-gray-400 text-xs">{selected.email}</p>
                  {selected.phone && <p className="text-gray-500 text-xs">{selected.phone}</p>}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white p-1">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Subscription summary */}
            <div className="p-4 border-b border-white/10">
              <h3 className="text-gray-400 text-xs uppercase tracking-wider mb-3">Abonnement actuel</h3>
              {selected.subscription ? (
                <div className="bg-[#192734] rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Statut</span>
                    <Badge className={`border text-xs ${STATUS_CONFIG[selected.subStatus]?.color}`}>
                      {STATUS_CONFIG[selected.subStatus]?.label}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Plan</span>
                    <span className="text-white text-sm font-medium">{selected.subscription.billing_plans?.name || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Prix</span>
                    <span className="text-white text-sm">
                      {selected.subscription.billing_plans?.price_amount} {selected.subscription.billing_plans?.price_currency}
                      <span className="text-gray-500 text-xs ml-1">/ {selected.subscription.billing_plans?.interval_type === 'monthly' ? 'mois' : selected.subscription.billing_plans?.interval_type === 'yearly' ? 'an' : selected.subscription.billing_plans?.interval_type}</span>
                    </span>
                  </div>
                  {selected.subscription.started_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Démarré le</span>
                      <span className="text-gray-300 text-sm">{format(new Date(selected.subscription.started_at), 'dd MMM yyyy', { locale: fr })}</span>
                    </div>
                  )}
                  {selected.subscription.expires_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Expire le</span>
                      <span className={`text-sm font-medium ${new Date(selected.subscription.expires_at) < new Date() ? 'text-red-400' : 'text-emerald-400'}`}>
                        {format(new Date(selected.subscription.expires_at), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[#192734] rounded-lg p-3 text-center text-gray-500 text-sm">
                  Aucun abonnement enregistré
                </div>
              )}
            </div>

            {/* Payment history */}
            <div className="flex-1 overflow-hidden flex flex-col p-4">
              <h3 className="text-gray-400 text-xs uppercase tracking-wider mb-3">Historique des paiements</h3>
              {detailLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
                </div>
              ) : (
                <ScrollArea className="flex-1">
                  {studentPayments.length === 0 ? (
                    <div className="text-center py-8 text-gray-600">
                      <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Aucun paiement enregistré</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {studentPayments.map((pay) => {
                        const ps = PAYMENT_STATUS_CONFIG[pay.payment_status] || { label: pay.payment_status, color: 'text-gray-400' };
                        const isConfirmed = String(pay.payment_status || '').toLowerCase() === 'confirmed';
                        const notSentBySchool = isConfirmed && !pay.invoice_sent_at;
                        const studentReported = isConfirmed && pay.invoice_student_not_received_at;
                        return (
                          <div key={pay.id} className="bg-[#192734] rounded-lg p-3 flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-white text-sm font-medium">
                                  {pay.price_amount} {pay.price_currency}
                                </p>
                                <p className="text-gray-500 text-xs">
                                  {pay.billing_plans?.name || '—'} · {pay.provider} · {pay.payment_method}
                                </p>
                                <p className="text-gray-600 text-xs">
                                  {format(new Date(pay.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                                </p>
                              </div>
                              <span className={`text-xs font-semibold shrink-0 ${ps.color}`}>{ps.label}</span>
                            </div>
                            {isConfirmed ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {notSentBySchool ? (
                                  <Badge className="bg-amber-500/20 text-amber-200 border-amber-500/30 text-[10px]">
                                    Facture e-mail non envoyée
                                  </Badge>
                                ) : (
                                  <Badge className="bg-emerald-500/15 text-emerald-200 border-emerald-500/25 text-[10px]">
                                    Facture envoyée
                                  </Badge>
                                )}
                                {studentReported ? (
                                  <Badge className="bg-orange-500/20 text-orange-200 border-orange-500/30 text-[10px]">
                                    Élève : pas reçue
                                  </Badge>
                                ) : null}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px] border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10"
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
