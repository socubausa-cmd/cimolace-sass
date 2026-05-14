import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle2, Loader2, RefreshCcw, Search, ShieldCheck, XCircle } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'En attente' },
  { value: 'approved', label: 'Approuvés' },
  { value: 'rejected', label: 'Rejetés' },
  { value: 'all', label: 'Tous' },
];

function ReviewStars({ rating }) {
  const value = Math.max(1, Math.min(5, Number(rating) || 0));
  return <span className="text-[#D4AF37]">{'★'.repeat(value)}</span>;
}

export default function SiteReviewsModerationPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState('');

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('site_reviews')
        .select('id,source,author_name,author_role,rating,review_text,is_verified,status,submitted_at,approved_at,is_spam_suspected,spam_reason')
        .order('submitted_at', { ascending: false })
        .limit(120);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast({
        title: 'Avis',
        description: String(e?.message || e),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.author_name, row.author_role, row.review_text, row.source]
        .map((v) => String(v || '').toLowerCase())
        .some((v) => v.includes(q))
    );
  }, [rows, search]);

  const updateReview = async (row, nextStatus) => {
    setUpdatingId(row.id);
    try {
      const payload = {
        status: nextStatus,
        approved_at: nextStatus === 'approved' ? new Date().toISOString() : null,
        approved_by: nextStatus === 'approved' ? user?.id || null : null,
      };
      const { error } = await supabase.from('site_reviews').update(payload).eq('id', row.id);
      if (error) throw error;
      toast({
        title: 'Modération',
        description: nextStatus === 'approved' ? 'Avis approuvé.' : 'Avis rejeté.',
      });
      await loadReviews();
    } catch (e) {
      toast({
        title: 'Modération',
        description: String(e?.message || e),
        variant: 'destructive',
      });
    } finally {
      setUpdatingId('');
    }
  };

  const toggleVerified = async (row) => {
    setUpdatingId(row.id);
    try {
      const { error } = await supabase
        .from('site_reviews')
        .update({ is_verified: !row.is_verified })
        .eq('id', row.id);
      if (error) throw error;
      toast({
        title: 'Modération',
        description: !row.is_verified ? 'Badge vérifié activé.' : 'Badge vérifié retiré.',
      });
      await loadReviews();
    } catch (e) {
      toast({
        title: 'Modération',
        description: String(e?.message || e),
        variant: 'destructive',
      });
    } finally {
      setUpdatingId('');
    }
  };

  const counts = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
      },
      { pending: 0, approved: 0, rejected: 0 }
    );
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="premium-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">Modération des témoignages publics</h2>
            <p className="text-sm text-gray-400">
              Validez les avis publiés sur la vitrine commerciale PRORASCIENCE.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-500/15 text-amber-200 border-amber-500/30">
              {counts.pending || 0} en attente
            </Badge>
            <Button
              variant="outline"
              className="border-white/10 text-white hover:bg-white/5"
              onClick={() => loadReviews()}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="premium-panel p-5 space-y-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                statusFilter === opt.value
                  ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#D4AF37]'
                  : 'border-white/10 text-gray-300 hover:bg-white/5'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un avis..."
            className="pl-9"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredRows.map((row) => (
          <article key={row.id} className="premium-panel p-5 border border-white/10 rounded-xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-white font-semibold">
                  {row.author_name}
                  {row.is_verified ? (
                    <span className="ml-2 inline-flex items-center gap-1 text-emerald-300 text-xs">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Vérifié
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-gray-400">
                  {row.author_role || 'Membre'} • {String(row.source || '').toUpperCase()} • {new Date(row.submitted_at).toLocaleString('fr-FR')}
                </p>
              </div>
              <div className="text-sm">
                <ReviewStars rating={row.rating} />
              </div>
            </div>

            <p className="mt-3 text-sm text-gray-200">{row.review_text}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {row.is_spam_suspected ? (
                <Badge className="bg-red-500/15 text-red-300 border-red-500/30">
                  Spam suspecté{row.spam_reason ? ` (${row.spam_reason})` : ''}
                </Badge>
              ) : null}
              <Badge
                className={
                  row.status === 'approved'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : row.status === 'rejected'
                    ? 'bg-red-500/15 text-red-300 border-red-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }
              >
                {row.status}
              </Badge>

              <Button
                variant="outline"
                className="border-white/10 text-white hover:bg-white/5"
                onClick={() => toggleVerified(row)}
                disabled={updatingId === row.id}
              >
                {row.is_verified ? 'Retirer vérifié' : 'Marquer vérifié'}
              </Button>

              {row.status !== 'approved' ? (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  onClick={() => updateReview(row, 'approved')}
                  disabled={updatingId === row.id}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Approuver
                </Button>
              ) : null}

              {row.status !== 'rejected' ? (
                <Button
                  variant="destructive"
                  onClick={() => updateReview(row, 'rejected')}
                  disabled={updatingId === row.id}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Rejeter
                </Button>
              ) : null}
            </div>
          </article>
        ))}

        {!filteredRows.length ? (
          <div className="premium-panel p-6 text-sm text-gray-400">Aucun avis pour ce filtre.</div>
        ) : null}
      </div>
    </div>
  );
}
