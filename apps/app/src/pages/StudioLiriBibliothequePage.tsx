/**
 * StudioLiriBibliothequePage — Assets & Templates Library
 * Route: /studio/liri/bibliotheque
 */
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Library, Image, Layers, FileText, Star,
  Loader2, Upload, Search, FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';

const TABS = [
  { id: 'assets', label: 'Assets', icon: Image, desc: 'Images, SVG, vidéos' },
  { id: 'templates', label: 'Templates', icon: Layers, desc: 'Modèles SmartBoard' },
  { id: 'community', label: 'Communauté', icon: Star, desc: 'Packs partagés' },
];

export default function StudioLiriBibliothequePage() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'assets');
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    const type = activeTab === 'templates' ? 'template' : 'image';
    const isTemplate = activeTab === 'templates';
    supabase
      .from('liri_assets')
      .select('*')
      .eq('is_template', isTemplate)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error: err }: any) => {
        if (err) setError(err.message);
        else setAssets(data || []);
        setLoading(false);
      });
  }, [activeTab]);

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a14] text-white">
      <header className="flex items-center gap-4 px-6 py-4 border-b border-white/[0.06]">
        <Link to="/studio/liri" className="text-white/40 hover:text-white/70">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-white">Bibliothèque</h1>
          <p className="text-[11px] text-white/30">Assets · templates · presets</p>
        </div>
        <div className="ml-auto">
          <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/[0.08]">
            <Upload className="h-3.5 w-3.5" /> Importer
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/[0.06] px-6">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn('flex items-center gap-2 px-4 py-3 text-[12px] font-medium border-b-2 transition-all',
                  activeTab === tab.id ? 'border-amber-400 text-amber-400' : 'border-transparent text-white/30 hover:text-white/50')}>
                <Icon className="h-4 w-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-white/20" />
            </div>
          ) : error ? (
            <p className="text-[12px] text-red-400">{error}</p>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FolderOpen className="h-12 w-12 text-white/10 mb-4" />
              <h2 className="text-[14px] font-medium text-white/40">Aucun asset</h2>
              <p className="text-[12px] text-white/20 mt-1">Importez des images, templates ou assets</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {assets.map((asset: any) => (
                <div key={asset.id} className="rounded-xl border border-white/[0.06] bg-white/[0.01] overflow-hidden hover:border-white/15 transition-all">
                  <div className="aspect-square bg-white/[0.02] flex items-center justify-center">
                    {asset.public_url ? (
                      <img src={asset.public_url} alt={asset.title} className="w-full h-full object-cover" />
                    ) : (
                      <Image className="h-8 w-8 text-white/10" />
                    )}
                  </div>
                  <div className="p-2.5">
                    <div className="text-[11px] font-medium text-white/70 truncate">{asset.title}</div>
                    <div className="text-[9px] text-white/25 truncate mt-0.5">{asset.asset_type}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
