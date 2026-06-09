import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Download, RefreshCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminMedAudit } from '@/lib/api';

const PAGE_SIZE = 50;

const TABS = [
  { id: 'log', label: 'Actions' },
  { id: 'ai', label: 'Appels IA' },
];

function toCsv(rows, columns) {
  if (!rows.length) return '';
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.map((c) => c.label).join(',');
  const body = rows
    .map((r) => columns.map((c) => escape(r[c.key])).join(','))
    .join('\n');
  return `${header}\n${body}`;
}

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const LOG_COLUMNS = [
  { key: 'created_at', label: 'Horodatage' },
  { key: 'actor_id', label: 'Acteur' },
  { key: 'action', label: 'Action' },
  { key: 'resource', label: 'Ressource' },
  { key: 'resource_id', label: 'ID Ressource' },
  { key: 'ip_address', label: 'IP' },
  { key: 'metadata', label: 'Métadonnées' },
];

const AI_COLUMNS = [
  { key: 'created_at', label: 'Horodatage' },
  { key: 'agent', label: 'Agent' },
  { key: 'model', label: 'Modèle' },
  { key: 'prompt_version', label: 'Prompt' },
  { key: 'tokens', label: 'Tokens' },
  { key: 'latency_ms', label: 'Latence (ms)' },
  { key: 'patient_id', label: 'Patient' },
  { key: 'error', label: 'Erreur' },
];

const MedAuditPage = () => {
  const [tab, setTab] = useState('log');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [resource, setResource] = useState('');
  const [action, setAction] = useState('');
  const [agent, setAgent] = useState('');
  const [patientId, setPatientId] = useState('');

  const columns = tab === 'log' ? LOG_COLUMNS : AI_COLUMNS;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        limit: PAGE_SIZE,
        offset,
        from: from || undefined,
        to: to || undefined,
      };
      let res;
      if (tab === 'log') {
        res = await adminMedAudit.list({
          ...params,
          resource: resource || undefined,
          action: action || undefined,
        });
      } else {
        res = await adminMedAudit.aiRuns({
          ...params,
          agent: agent || undefined,
          patient_id: patientId || undefined,
        });
      }
      setRows(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch (e) {
      setError(e.message || 'Erreur de chargement');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tab, offset, from, to, resource, action, agent, patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleTabChange = (id) => {
    if (id === tab) return;
    setTab(id);
    setOffset(0);
    setRows([]);
    setTotal(0);
  };

  const handleApplyFilters = () => {
    setOffset(0);
    load();
  };

  const handleExport = () => {
    const csv = toCsv(rows, columns);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    downloadCsv(`med-audit-${tab}-${ts}.csv`, csv);
  };

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const renderCell = (row, col) => {
    const v = row[col.key];
    if (v === null || v === undefined || v === '') return <span className="text-gray-600">—</span>;
    if (col.key === 'created_at') return new Date(v).toLocaleString();
    if (col.key === 'metadata' || typeof v === 'object') {
      return (
        <code className="text-xs bg-black/30 p-1 rounded text-gray-400 max-w-[260px] block truncate">
          {JSON.stringify(v)}
        </code>
      );
    }
    if (col.key === 'action') {
      const cls =
        v === 'create' || v === 'insert'
          ? 'bg-green-500/20 text-green-400'
          : v === 'delete'
          ? 'bg-red-500/20 text-red-400'
          : 'bg-blue-500/20 text-blue-400';
      return (
        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${cls}`}>
          {String(v)}
        </span>
      );
    }
    const s = String(v);
    if (s.length > 40) {
      return <span className="text-gray-300" title={s}>{s.slice(0, 8)}…</span>;
    }
    return <span className="text-gray-300">{s}</span>;
  };

  return (
    <div className="min-h-screen premium-dashboard-shell text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-serif font-bold">Audit MedOS</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-white/10 text-white hover:bg-white/5 gap-2"
              onClick={() => load()}
            >
              <RefreshCcw className="w-4 h-4" /> Rafraîchir
            </Button>
            <Button
              variant="outline"
              className="border-white/10 text-white hover:bg-white/5 gap-2"
              onClick={handleExport}
              disabled={!rows.length}
            >
              <Download className="w-4 h-4" /> Exporter CSV
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-white/10">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabChange(t.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-[#7B61FF] text-white'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="premium-panel p-4 mb-6 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Du</label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-[#0F1419] border-white/10"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Au</label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-[#0F1419] border-white/10"
            />
          </div>
          {tab === 'log' ? (
            <>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Ressource</label>
                <Input
                  value={resource}
                  onChange={(e) => setResource(e.target.value)}
                  placeholder="ex: patient"
                  className="bg-[#0F1419] border-white/10"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Action</label>
                <Input
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  placeholder="ex: create"
                  className="bg-[#0F1419] border-white/10"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Agent</label>
                <Input
                  value={agent}
                  onChange={(e) => setAgent(e.target.value)}
                  placeholder="ex: exams"
                  className="bg-[#0F1419] border-white/10"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Patient ID</label>
                <Input
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  placeholder="UUID patient"
                  className="bg-[#0F1419] border-white/10"
                />
              </div>
            </>
          )}
          <div className="flex items-end">
            <Button
              onClick={handleApplyFilters}
              className="w-full bg-[#7B61FF] hover:bg-[#6a52e5]"
            >
              Appliquer
            </Button>
          </div>
        </div>

        {error ? (
          <div className="premium-panel p-4 mb-6 text-red-400 text-sm">{error}</div>
        ) : null}

        <div className="premium-panel overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="animate-spin text-[#7B61FF] w-8 h-8" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">
              Aucune entrée
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-gray-400 uppercase text-xs">
                  <tr>
                    {columns.map((c) => (
                      <th key={c.key} className="px-4 py-3 font-medium">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-white/5 transition-colors">
                      {columns.map((c) => (
                        <td key={c.key} className="px-4 py-3 align-top">
                          {renderCell(row, c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
          <div>
            {total > 0
              ? `${offset + 1}–${Math.min(offset + rows.length, total)} sur ${total}`
              : '—'}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={offset === 0 || loading}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="text-white hover:bg-white/5 gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Précédent
            </Button>
            <span className="px-2">
              Page {page} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={offset + PAGE_SIZE >= total || loading}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="text-white hover:bg-white/5 gap-1"
            >
              Suivant <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedAuditPage;
