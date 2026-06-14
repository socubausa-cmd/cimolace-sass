import React from 'react';
import { useAuditLogs } from '@/hooks/useAdmin';
import { Loader2, Search, Filter, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const AuditLogsPage = () => {
  const { logs, loading } = useAuditLogs();

  return (
    <div className="min-h-screen premium-dashboard-shell text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-serif font-bold">Journaux d'Audit</h1>
          <Button variant="outline" className="border-white/10 text-white hover:bg-white/5 gap-2">
            <Download className="w-4 h-4" /> Exporter CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="premium-panel p-4 mb-6 flex gap-4">
           <div className="relative flex-1">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
             <Input placeholder="Rechercher dans les logs..." className="pl-10 bg-[#0F1419] border-white/10" />
           </div>
           <Button variant="ghost" className="border border-white/10 gap-2"><Filter className="w-4 h-4" /> Filtres</Button>
        </div>

        <div className="premium-panel overflow-hidden">
          {loading ? (
             <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[var(--school-accent)] w-8 h-8" /></div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-gray-400 uppercase font-medium">
                <tr>
                  <th className="px-6 py-4">Horodatage</th>
                  <th className="px-6 py-4">Utilisateur</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Ressource</th>
                  <th className="px-6 py-4">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-gray-400">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {log.profiles?.full_name || log.user_id}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                        log.action === 'create' ? 'bg-green-500/20 text-green-400' :
                        log.action === 'delete' ? 'bg-red-500/20 text-red-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      {log.resource_type} <span className="text-gray-600 text-xs">#{log.resource_id?.slice(0,8)}</span>
                    </td>
                    <td className="px-6 py-4">
                       <code className="text-xs bg-black/30 p-1 rounded text-gray-400 max-w-[200px] block truncate">
                          {JSON.stringify(log.changes)}
                       </code>
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

export default AuditLogsPage;