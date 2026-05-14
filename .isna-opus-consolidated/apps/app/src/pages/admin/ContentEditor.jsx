import React, { useMemo, useState } from 'react';
import { useContent } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  FileText, 
  Box, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Loader2,
  RefreshCw,
  Download,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';

const toCsv = (rows) => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escapeCell = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escapeCell(r[h])).join(','))].join('\n');
};

const ContentEditor = () => {
  const [activeTab, setActiveTab] = useState('pages');
  const [statusFilter, setStatusFilter] = useState('all');
  const [localQuery, setLocalQuery] = useState('');
  const { toast } = useToast();
  const { data: contentData, loading, error, refresh, deleteContent } = useContent(activeTab);
  
  // Minimal placeholder for editor form logic
  const handleCreate = () => {
    alert("Ouverture du formulaire de création (Feature à venir)");
  };

  const handleDelete = async (id) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce contenu ?")) {
      const { error: delErr } = await deleteContent(id);
      if (delErr) {
        toast({ title: 'Erreur', description: delErr.message || 'Suppression impossible', variant: 'destructive' });
      } else {
        toast({ title: 'Supprimé', description: 'Le contenu a été supprimé.' });
      }
    }
  };

  const filteredContent = useMemo(() => {
    return contentData.filter((item) => {
      const matchesStatus =
        statusFilter === 'all' ? true : statusFilter === 'published' ? item.published : !item.published;
      const q = String(localQuery || '').trim().toLowerCase();
      if (!q) return matchesStatus;
      const haystack = `${item.title || ''} ${item.page_slug || ''} ${item.module_slug || ''}`.toLowerCase();
      return matchesStatus && haystack.includes(q);
    });
  }, [contentData, statusFilter, localQuery]);

  const handleExport = () => {
    const rows = filteredContent.map((item) => ({
      title: item.title,
      slug: item.page_slug || item.module_slug || '',
      status: item.published ? 'published' : 'draft',
      updated_at: item.updated_at,
    }));
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-content-${activeTab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0F1419] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-serif font-bold">Éditeur de Contenu</h1>
          <div className="flex items-center gap-2">
            <Button onClick={refresh} variant="outline" className="border-white/10 text-white hover:bg-white/5 gap-2" disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
            </Button>
            <Button onClick={handleExport} variant="outline" className="border-white/10 text-white hover:bg-white/5 gap-2" disabled={filteredContent.length === 0}>
              <Download className="w-4 h-4" /> Export CSV
            </Button>
            <Button onClick={handleCreate} className="bg-[#D4AF37] text-black hover:bg-[#b5952f] gap-2">
              <Plus className="w-4 h-4" /> Nouveau Contenu
            </Button>
          </div>
        </div>

        <PremiumSegmentedSelector
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'pages', label: 'Pages', icon: FileText },
            { value: 'modules', label: 'Modules', icon: Box },
          ]}
          layoutId="admin-content-editor-type-segment-pill"
          className="mb-4"
          compact
          showChevron={false}
        />

        <div className="mb-6 flex flex-col md:flex-row gap-3">
          <Input
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder="Filtrer par titre ou slug..."
            className="bg-[#192734] border-white/10"
          />
          <PremiumSegmentedSelector
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'Tous' },
              { value: 'published', label: 'Publies' },
              { value: 'draft', label: 'Brouillons' },
            ]}
            layoutId="admin-content-editor-status-segment-pill"
            compact
            showChevron={false}
          />
        </div>

        {error ? (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-300 mt-0.5" />
            <p className="text-red-200 text-sm">{String(error?.message || error)}</p>
          </div>
        ) : null}

        <div className="bg-[#192734] rounded-xl border border-white/5 overflow-hidden">
          {loading ? (
             <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[#D4AF37] w-8 h-8" /></div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-gray-400 uppercase font-medium">
                <tr>
                  <th className="px-6 py-4">Titre</th>
                  <th className="px-6 py-4">Slug / Code</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4">Mise à jour</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredContent.length === 0 ? (
                   <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">Aucun contenu trouvé.</td></tr>
                ) : filteredContent.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">{item.title}</td>
                    <td className="px-6 py-4 text-gray-400 font-mono text-xs">{item.page_slug || item.module_slug}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                        item.published ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {item.published ? 'Publié' : 'Brouillon'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {new Date(item.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                         <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white">
                            <Eye className="w-4 h-4" />
                         </Button>
                         <Button variant="ghost" size="icon" className="h-8 w-8 text-[#D4AF37] hover:bg-[#D4AF37]/10">
                            <Edit className="w-4 h-4" />
                         </Button>
                         <Button onClick={() => handleDelete(item.id)} variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10">
                            <Trash2 className="w-4 h-4" />
                         </Button>
                      </div>
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

export default ContentEditor;