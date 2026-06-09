import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Activity, Coins, Zap } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { adminTwin } from '@/lib/api';

const COST_NOTE =
  "Coûts estimés tarif Claude sonnet-4-6 ($15/Mtoks output). Tarif input non comptabilisé.";

const monthBounds = () => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { from: fmt(start), to: fmt(end) };
};

const formatNumber = (n) =>
  (typeof n === 'number' ? n : 0).toLocaleString('fr-FR');

const formatCost = (n) => `$${(typeof n === 'number' ? n : 0).toFixed(4)}`;

const MedAiUsagePage = () => {
  const initial = monthBounds();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminTwin.usage(from, to);
      setReport(data);
    } catch (err) {
      setError(err?.message || 'Erreur de chargement');
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartData = useMemo(
    () =>
      (report?.by_day ?? []).map((d) => ({
        date: d.date.slice(5), // MM-DD
        tokens: d.tokens,
      })),
    [report],
  );

  return (
    <div className="min-h-screen premium-dashboard-shell text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-serif font-bold">MEDOS — Consommation IA</h1>
            <p className="text-sm text-gray-400 mt-1">{COST_NOTE}</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm text-gray-400 flex flex-col">
              Du
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 bg-[#0F1419] border border-white/10 rounded px-3 py-2 text-white"
              />
            </label>
            <label className="text-sm text-gray-400 flex flex-col">
              Au
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 bg-[#0F1419] border border-white/10 rounded px-3 py-2 text-white"
              />
            </label>
            <button
              type="button"
              onClick={load}
              className="bg-[#7B61FF] hover:bg-[#6a51e0] transition-colors text-white font-medium px-4 py-2 rounded"
            >
              Recalculer
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Header KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <KpiCard
            icon={<Coins className="w-5 h-5 text-[#D4AF37]" />}
            label="Coût estimé"
            value={loading ? '…' : formatCost(report?.total_cost_usd ?? 0)}
            subtitle={
              report?.period
                ? `${report.period.from} → ${report.period.to}`
                : '—'
            }
          />
          <KpiCard
            icon={<Zap className="w-5 h-5 text-[#7B61FF]" />}
            label="Tokens"
            value={loading ? '…' : formatNumber(report?.total_tokens ?? 0)}
            subtitle="Cumulés sur la période"
          />
          <KpiCard
            icon={<Activity className="w-5 h-5 text-green-400" />}
            label="Exécutions IA"
            value={loading ? '…' : formatNumber(report?.total_runs ?? 0)}
            subtitle="Nombre d'appels agents"
          />
        </div>

        {/* Chart par jour */}
        <div className="premium-panel p-5 mb-6">
          <h2 className="text-lg font-bold mb-4">Tokens par jour</h2>
          {loading ? (
            <div className="h-72 flex items-center justify-center">
              <Loader2 className="animate-spin text-[#7B61FF] w-8 h-8" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-gray-500">
              Aucune consommation enregistrée sur cette période.
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="#ffffff10" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: '#0F1419',
                      border: '1px solid #ffffff20',
                      color: '#fff',
                    }}
                    formatter={(value) => [formatNumber(value), 'tokens']}
                  />
                  <Bar dataKey="tokens" fill="#7B61FF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Tableau par agent */}
        <div className="premium-panel overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h2 className="text-lg font-bold">Détail par agent</h2>
          </div>
          {loading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="animate-spin text-[#7B61FF] w-8 h-8" />
            </div>
          ) : (report?.by_agent ?? []).length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Aucune exécution d'agent sur la période.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-gray-400 uppercase font-medium">
                <tr>
                  <th className="px-6 py-3">Agent</th>
                  <th className="px-6 py-3 text-right">Exécutions</th>
                  <th className="px-6 py-3 text-right">Tokens</th>
                  <th className="px-6 py-3 text-right">Coût estimé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {report.by_agent.map((row) => (
                  <tr key={row.agent} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-3 font-medium text-white">{row.agent}</td>
                    <td className="px-6 py-3 text-right text-gray-300">
                      {formatNumber(row.runs)}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-300">
                      {formatNumber(row.tokens)}
                    </td>
                    <td className="px-6 py-3 text-right text-[#D4AF37]">
                      {formatCost(row.cost_usd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const KpiCard = ({ icon, label, value, subtitle }) => (
  <div className="premium-panel p-5">
    <div className="flex items-center gap-2 text-gray-400 text-sm">
      {icon}
      <span>{label}</span>
    </div>
    <div className="mt-2 text-2xl font-bold text-white">{value}</div>
    <div className="mt-1 text-xs text-gray-500">{subtitle}</div>
  </div>
);

export default MedAiUsagePage;
