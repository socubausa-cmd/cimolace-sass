/**
 * Studio Ad Creator — Créateur de publicités IA multi-plateformes
 * Route: /studio/ad-creator
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Megaphone, Sparkles, ArrowLeft, ArrowRight, Check, Copy, Download,
  Facebook, Youtube, Globe, Zap, Target, Eye, BarChart3, RefreshCw,
  Loader2, Plus, Trash2, Edit3, Play, Pause, Film, BookOpen,
  Instagram, Share2, TrendingUp, Settings, Link2, ChevronDown,
  ChevronUp, CheckCircle2, AlertCircle, Clock, Star, ClipboardList,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { resolveNetlifyApiUrl } from '@/lib/resolveNetlifyApiUrl';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30', formats: ['feed', 'story', 'carousel', 'reel'] },
  { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-400', bg: 'bg-pink-500/15', border: 'border-pink-500/30', formats: ['feed', 'story', 'reel', 'carousel'] },
  { id: 'tiktok', label: 'TikTok', icon: Film, color: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30', formats: ['short', 'feed'] },
  { id: 'youtube', label: 'YouTube', icon: Youtube, color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', formats: ['short', 'banner', 'feed'] },
  { id: 'google', label: 'Google Ads', icon: Globe, color: 'text-yellow-400', bg: 'bg-yellow-500/15', border: 'border-yellow-500/30', formats: ['banner', 'search'] },
  { id: 'multi', label: 'Multi-canal', icon: Share2, color: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/30', formats: ['feed', 'story', 'short'] },
];

const OBJECTIVES = [
  { id: 'acquisition', label: 'Acquisition', desc: 'Attirer de nouveaux prospects', icon: Target, color: 'text-blue-400' },
  { id: 'conversion', label: 'Conversion', desc: 'Transformer en clients payants', icon: TrendingUp, color: 'text-emerald-400' },
  { id: 'awareness', label: 'Notoriété', desc: 'Faire connaître votre marque', icon: Eye, color: 'text-purple-400' },
  { id: 'retargeting', label: 'Relance', desc: 'Relancer les prospects tièdes', icon: RefreshCw, color: 'text-amber-400' },
  { id: 'engagement', label: 'Engagement', desc: 'Générer interactions et partages', icon: Star, color: 'text-pink-400' },
];

const FORMAT_LABELS = { feed: 'Fil d\'actualité', story: 'Story (9:16)', reel: 'Reel / Short', short: 'Short vidéo', banner: 'Bannière', search: 'Annonce search', carousel: 'Carrousel' };

const CHANNEL_CONFIGS = [
  { platform: 'facebook', label: 'Meta (Facebook / Instagram)', icon: Facebook, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/25', desc: 'Facebook Ads + Instagram Ads via Meta Business Suite', fields: [{ key: 'pixel_id', label: 'Pixel ID', placeholder: '1234567890' }, { key: 'access_token', label: 'Token d\'accès', placeholder: 'EAAxxxx...', secret: true }, { key: 'ad_account_id', label: 'ID Compte publicitaire', placeholder: 'act_123456789' }] },
  { platform: 'tiktok', label: 'TikTok Ads', icon: Film, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/25', desc: 'TikTok for Business — pixel et campagnes automatisées', fields: [{ key: 'pixel_id', label: 'Pixel ID', placeholder: 'XXXXXXXX' }, { key: 'access_token', label: 'Token d\'accès', placeholder: 'xxxxx', secret: true }, { key: 'advertiser_id', label: 'Advertiser ID', placeholder: '7234567890' }] },
  { platform: 'youtube', label: 'YouTube (Google Ads)', icon: Youtube, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25', desc: 'Google Ads avec ciblage YouTube et search', fields: [{ key: 'client_id', label: 'Client ID', placeholder: 'xxxx.apps.googleusercontent.com' }, { key: 'client_secret', label: 'Client Secret', placeholder: 'xxxxx', secret: true }, { key: 'customer_id', label: 'Customer ID', placeholder: '123-456-7890' }] },
  { platform: 'google_analytics', label: 'Google Analytics 4', icon: BarChart3, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/25', desc: 'Suivi du tunnel de vente et des conversions', fields: [{ key: 'measurement_id', label: 'Measurement ID (G-XXXXXXXX)', placeholder: 'G-XXXXXXXXXX' }, { key: 'api_secret', label: 'API Secret', placeholder: 'xxxxx', secret: true }] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getPlatform = (id) => PLATFORMS.find((p) => p.id === id) || PLATFORMS[0];

async function authFetch(url, options = {}) {
  const { data: sessData } = await supabase.auth.getSession();
  const token = sessData?.session?.access_token;
  if (!token) throw new Error('Session invalide');
  const resolved = resolveNetlifyApiUrl(url);
  const res = await fetch(resolved, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error || 'Erreur API');
  return payload;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepDots({ step, total }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-full transition-all',
            i < step ? 'w-6 h-2 bg-[#D4AF37]' : i === step - 1 ? 'w-8 h-2 bg-[#D4AF37]' : 'w-2 h-2 bg-white/15'
          )}
        />
      ))}
      <span className="text-xs text-gray-400 ml-1">{step}/{total}</span>
    </div>
  );
}

function PlatformCard({ platform, selected, onSelect }) {
  const p = getPlatform(platform.id);
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(platform.id)}
      className={cn(
        'relative p-4 rounded-xl border text-left transition-all',
        selected ? `${platform.border} ${platform.bg}` : 'border-white/10 bg-white/3 hover:bg-white/5'
      )}
    >
      {selected && <div className="absolute top-2 right-2 w-5 h-5 bg-[#D4AF37] rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-black" /></div>}
      <platform.icon className={cn('w-6 h-6 mb-3', platform.color)} />
      <p className="text-sm font-semibold text-white">{platform.label}</p>
      <p className="text-xs text-gray-400 mt-1">{platform.formats.slice(0, 2).map((f) => FORMAT_LABELS[f] || f).join(' · ')}</p>
    </motion.button>
  );
}

function AdPreviewCard({ platform, headline, description, cta, hashtags, format }) {
  const p = getPlatform(platform);
  const isVertical = ['story', 'reel', 'short'].includes(format);
  return (
    <div className={cn('rounded-2xl border overflow-hidden', p.border, p.bg)}>
      <div className="px-3 py-2 flex items-center gap-2 border-b border-white/8">
        <p.icon className={cn('w-4 h-4', p.color)} />
        <span className="text-xs text-gray-300">{p.label}</span>
        <span className="ml-auto text-[10px] text-gray-500">{FORMAT_LABELS[format] || format}</span>
      </div>
      <div className={cn('bg-[#0B1017] flex items-center justify-center', isVertical ? 'h-40' : 'h-28')}>
        <div className="text-center">
          <Film className="w-8 h-8 text-gray-600 mx-auto mb-1" />
          <p className="text-xs text-gray-600">Aperçu visuel</p>
        </div>
      </div>
      <div className="p-3 space-y-1">
        {headline && <p className="text-sm font-semibold text-white line-clamp-2">{headline}</p>}
        {description && <p className="text-xs text-gray-300 line-clamp-3">{description}</p>}
        {hashtags?.length > 0 && (
          <p className="text-xs text-blue-400">{hashtags.slice(0, 4).map((h) => `#${h.replace('#', '')}`).join(' ')}</p>
        )}
        {cta && (
          <button type="button" className={cn('mt-2 w-full py-1.5 rounded-lg text-xs font-semibold', p.bg, p.color, 'border', p.border)}>
            {cta}
          </button>
        )}
      </div>
    </div>
  );
}

function ChannelCard({ config, integration, onSave }) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const isConnected = integration?.status === 'connected';

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(config.platform, form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn('rounded-xl border p-4 transition-all', isConnected ? `${config.border} ${config.bg}` : 'border-white/10 bg-white/3')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', config.bg, 'border', config.border)}>
            <config.icon className={cn('w-5 h-5', config.color)} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{config.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{config.desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', isConnected ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-white/5 text-gray-400 border-white/10')}>
            {isConnected ? '✓ Connecté' : 'Non connecté'}
          </span>
          <button type="button" onClick={() => setExpanded((e) => !e)} className="p-1 text-gray-400 hover:text-white transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-2 pt-4 border-t border-white/8">
              {config.fields.map((field) => (
                <div key={field.key}>
                  <label className="text-xs text-gray-400 mb-1 block">{field.label}</label>
                  <input
                    type={field.secret ? 'password' : 'text'}
                    placeholder={field.placeholder}
                    value={form[field.key] || ''}
                    onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
                    className="w-full bg-[#0F1419] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/40"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="mt-2 w-full py-2 rounded-lg bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#e5c04a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {isConnected ? 'Mettre à jour' : 'Connecter ce canal'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StudioAdCreatorPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('create');
  const [step, setStep] = useState(1);
  /** Sous-écrans étape 1 : 0 = plateformes, 1 = format + objectifs */
  const [adStep1Pane, setAdStep1Pane] = useState(0);
  const [recapOpen, setRecapOpen] = useState(false);

  // Step 1 — Platform + Objective
  const [selectedPlatform, setSelectedPlatform] = useState('facebook');
  const [selectedFormat, setSelectedFormat] = useState('feed');
  const [selectedObjective, setSelectedObjective] = useState('acquisition');

  // Step 2 — Source
  const [sourceType, setSourceType] = useState('manual');
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceDescription, setSourceDescription] = useState('');
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(30);
  const [modules, setModules] = useState([]);
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [loadingModules, setLoadingModules] = useState(false);

  // Step 3 — Generated content
  const [generating, setGenerating] = useState(false);
  const [adContent, setAdContent] = useState({ headline: '', description: '', cta: 'Commencer maintenant', hashtags: [], hook: '', variations: [] });
  const [activeVariation, setActiveVariation] = useState(null);
  const [saving, setSaving] = useState(false);

  // History
  const [creatives, setCreatives] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Channels
  const [integrations, setIntegrations] = useState({});
  const [loadingChannels, setLoadingChannels] = useState(false);

  // ─── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (step !== 1) setAdStep1Pane(0);
  }, [step]);

  useEffect(() => {
    if (activeTab === 'sources' || sourceType === 'module') fetchModules();
  }, [activeTab, sourceType]);

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'channels') fetchChannels();
  }, [activeTab]);

  const fetchModules = async () => {
    setLoadingModules(true);
    try {
      const { data } = await supabase
        .from('modules')
        .select('id, title, description, video_url')
        .order('created_at', { ascending: false })
        .limit(20);
      setModules(data || []);
    } catch (e) {
      console.error('fetchModules', e);
    } finally {
      setLoadingModules(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('ad_creatives')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      setCreatives(data || []);
    } catch (e) {
      console.error('fetchHistory', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchChannels = async () => {
    setLoadingChannels(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('channel_integrations')
        .select('*')
        .eq('owner_id', user.id);
      const map = {};
      (data || []).forEach((row) => { map[row.platform] = row; });
      setIntegrations(map);
    } catch (e) {
      console.error('fetchChannels', e);
    } finally {
      setLoadingChannels(false);
    }
  };

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleSelectModule = useCallback((mod) => {
    setSelectedModuleId(mod.id);
    setSourceTitle(mod.title || '');
    setSourceDescription(mod.description || '');
    setSourceType('module');
  }, []);

  const generateAdCopy = async () => {
    if (!sourceTitle.trim() && !sourceDescription.trim()) {
      toast({ title: 'Source requise', description: 'Ajoutez un titre ou une description.', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const payload = await authFetch('/api/ad/copy-generate', {
        method: 'POST',
        body: JSON.stringify({
          platform: selectedPlatform,
          objective: selectedObjective,
          sourceTitle,
          sourceDescription,
          language: 'fr',
          tone: 'professional',
        }),
      });
      setAdContent({
        headline: payload.headline || '',
        description: payload.description || '',
        cta: payload.cta || 'Commencer maintenant',
        hashtags: payload.hashtags || [],
        hook: payload.hook || '',
        variations: payload.variations || [],
      });
      setActiveVariation(null);
      toast({ title: 'Publicité générée', description: 'Contenu IA créé avec succès.' });
    } catch (e) {
      toast({ title: 'Erreur IA', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const saveCreative = async (status = 'draft') => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');
      const active = activeVariation !== null ? adContent.variations[activeVariation] : null;
      const content = active || adContent;
      await supabase.from('ad_creatives').insert({
        created_by: user.id,
        title: sourceTitle || 'Publicité sans titre',
        status,
        platform: selectedPlatform,
        format: selectedFormat,
        objective: selectedObjective,
        source_type: sourceType,
        source_id: selectedModuleId || null,
        source_title: sourceTitle,
        clip_start_seconds: sourceType === 'clip' ? clipStart : null,
        clip_end_seconds: sourceType === 'clip' ? clipEnd : null,
        headline: content.headline,
        description: content.description,
        cta: content.cta,
        hashtags: content.hashtags || [],
        published_at: status === 'published' ? new Date().toISOString() : null,
      });
      toast({ title: status === 'published' ? 'Publicité publiée !' : 'Brouillon sauvegardé', description: 'Retrouvez-la dans "Mes publicités".' });
      if (activeTab === 'history') fetchHistory();
    } catch (e) {
      toast({ title: 'Sauvegarde impossible', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const saveChannelIntegration = async (platform, config) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');
      await supabase.from('channel_integrations').upsert({
        owner_id: user.id,
        platform,
        status: 'connected',
        config,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: 'owner_id,platform' });
      toast({ title: 'Canal connecté', description: `${platform} intégré avec succès.` });
      fetchChannels();
    } catch (e) {
      toast({ title: 'Connexion impossible', description: String(e?.message || e), variant: 'destructive' });
    }
  };

  const currentPlatform = getPlatform(selectedPlatform);
  const displayContent = activeVariation !== null && adContent.variations[activeVariation]
    ? { ...adContent, ...adContent.variations[activeVariation] }
    : adContent;

  // ─── Step renderers ─────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-6">
      {adStep1Pane === 0 && (
        <div>
          <h3 className="mb-1 text-base font-semibold text-white">Plateforme de diffusion</h3>
          <p className="mb-3 text-xs text-gray-400">Où sera diffusée votre publicité ?</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PLATFORMS.map((p) => (
              <PlatformCard
                key={p.id}
                platform={p}
                selected={selectedPlatform === p.id}
                onSelect={(id) => {
                  setSelectedPlatform(id);
                  setSelectedFormat(getPlatform(id).formats[0]);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {adStep1Pane === 1 && (
        <>
          {currentPlatform.formats.length > 1 && (
            <div>
              <h3 className="mb-3 text-base font-semibold text-white">Format</h3>
              <div className="flex flex-wrap gap-2">
                {currentPlatform.formats.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setSelectedFormat(f)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                      selectedFormat === f
                        ? `${currentPlatform.bg} ${currentPlatform.color} ${currentPlatform.border}`
                        : 'border-white/10 text-gray-400 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    {FORMAT_LABELS[f] || f}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-3 text-base font-semibold text-white">Objectif</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {OBJECTIVES.map((obj) => (
                <button
                  key={obj.id}
                  type="button"
                  onClick={() => setSelectedObjective(obj.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 text-left transition-all',
                    selectedObjective === obj.id
                      ? 'border-[#D4AF37]/35 bg-[#D4AF37]/10'
                      : 'border-white/10 bg-white/3 hover:bg-white/5',
                  )}
                >
                  <obj.icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      selectedObjective === obj.id ? 'text-[#D4AF37]' : obj.color,
                    )}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{obj.label}</p>
                    <p className="truncate text-xs text-gray-400">{obj.desc}</p>
                  </div>
                  {selectedObjective === obj.id && (
                    <Check className="ml-auto h-4 w-4 shrink-0 text-[#D4AF37]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-white mb-1">Source du contenu</h3>
        <p className="text-xs text-gray-400 mb-3">D'où vient le contenu de votre publicité ?</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { id: 'manual', label: 'Texte libre', icon: Edit3 },
            { id: 'module', label: 'Module de cours', icon: BookOpen },
            { id: 'clip', label: 'Extrait vidéo', icon: Film },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSourceType(s.id)}
              className={cn(
                'p-3 rounded-xl border text-center transition-all',
                sourceType === s.id
                  ? 'border-[#D4AF37]/35 bg-[#D4AF37]/10'
                  : 'border-white/10 bg-white/3 hover:bg-white/5'
              )}
            >
              <s.icon className={cn('w-5 h-5 mx-auto mb-1.5', sourceType === s.id ? 'text-[#D4AF37]' : 'text-gray-400')} />
              <p className="text-xs font-medium text-white">{s.label}</p>
            </button>
          ))}
        </div>
      </div>

      {sourceType === 'module' && (
        <div>
          <p className="text-xs text-gray-400 mb-2">Sélectionner un module</p>
          {loadingModules ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Chargement...</div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {modules.map((mod) => (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => handleSelectModule(mod)}
                  className={cn(
                    'w-full text-left p-3 rounded-xl border transition-all',
                    selectedModuleId === mod.id
                      ? 'border-[#D4AF37]/35 bg-[#D4AF37]/8'
                      : 'border-white/10 bg-white/3 hover:bg-white/5'
                  )}
                >
                  <p className="text-sm font-medium text-white line-clamp-1">{mod.title}</p>
                  {mod.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{mod.description}</p>}
                </button>
              ))}
              {!modules.length && <p className="text-xs text-gray-500 text-center py-4">Aucun module disponible.</p>}
            </div>
          )}
        </div>
      )}

      {sourceType === 'clip' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">Entrez l'URL de l'enregistrement ou de la vidéo</p>
          <input
            type="url"
            placeholder="https://... (URL vidéo, enregistrement live)"
            value={sourceDescription}
            onChange={(e) => setSourceDescription(e.target.value)}
            className="w-full bg-[#0F1419] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/40"
          />
          <div className="rounded-xl border border-white/10 bg-[#0B1017] p-4 space-y-3">
            <div className="flex items-center justify-center h-20 rounded-lg bg-black/30">
              <Film className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-xs text-gray-400 text-center">Sélectionner le début et la fin du clip</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-12">Début</span>
                <input type="range" min={0} max={300} value={clipStart} onChange={(e) => setClipStart(Number(e.target.value))} className="flex-1 accent-[#D4AF37]" />
                <span className="text-xs text-[#D4AF37] w-10 text-right">{clipStart}s</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-12">Fin</span>
                <input type="range" min={0} max={300} value={clipEnd} onChange={(e) => setClipEnd(Math.max(clipStart + 5, Number(e.target.value)))} className="flex-1 accent-[#D4AF37]" />
                <span className="text-xs text-[#D4AF37] w-10 text-right">{clipEnd}s</span>
              </div>
              <p className="text-[10px] text-gray-500 text-center">Durée sélectionnée : {clipEnd - clipStart} secondes</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Titre / Sujet de la publicité *</label>
          <input
            type="text"
            placeholder="Ex : Maîtrisez la symbolique du cycle Initié"
            value={sourceTitle}
            onChange={(e) => setSourceTitle(e.target.value)}
            className="w-full bg-[#0F1419] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/40"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Description (contexte pour l'IA)</label>
          <textarea
            rows={3}
            placeholder="Décrivez le contenu, la valeur apportée, le public cible..."
            value={sourceDescription}
            onChange={(e) => setSourceDescription(e.target.value)}
            className="w-full bg-[#0F1419] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/40 resize-none"
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-white">Contenu généré</h3>
          <p className="text-xs text-gray-400">Éditez, puis sauvegardez ou publiez.</p>
        </div>
        <button
          type="button"
          onClick={generateAdCopy}
          disabled={generating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-sm hover:bg-[#D4AF37]/25 transition-all disabled:opacity-50"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {adContent.headline ? 'Regénérer' : 'Générer avec l\'IA'}
        </button>
      </div>

      {adContent.hook && (
        <div className="rounded-xl bg-[#D4AF37]/8 border border-[#D4AF37]/20 px-4 py-3">
          <p className="text-xs text-[#D4AF37] uppercase tracking-wider mb-1">Accroche</p>
          <p className="text-sm text-white font-medium italic">"{adContent.hook}"</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Editor */}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Titre / Headline</label>
            <input
              type="text"
              value={displayContent.headline}
              onChange={(e) => setAdContent((p) => ({ ...p, headline: e.target.value }))}
              placeholder="Titre de la publicité"
              className="w-full bg-[#0F1419] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/40"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Description</label>
            <textarea
              rows={4}
              value={displayContent.description}
              onChange={(e) => setAdContent((p) => ({ ...p, description: e.target.value }))}
              placeholder="Description de la publicité"
              className="w-full bg-[#0F1419] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/40 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Bouton CTA</label>
              <input
                type="text"
                value={displayContent.cta}
                onChange={(e) => setAdContent((p) => ({ ...p, cta: e.target.value }))}
                placeholder="Commencer maintenant"
                className="w-full bg-[#0F1419] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/40"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Hashtags (csv)</label>
              <input
                type="text"
                value={(displayContent.hashtags || []).join(', ')}
                onChange={(e) => setAdContent((p) => ({ ...p, hashtags: e.target.value.split(',').map((h) => h.trim()).filter(Boolean) }))}
                placeholder="#prorascience, #formation"
                className="w-full bg-[#0F1419] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/40"
              />
            </div>
          </div>

          {adContent.variations?.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-2">Variantes A/B</p>
              <div className="space-y-1">
                {adContent.variations.map((v, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveVariation(activeVariation === i ? null : i)}
                    className={cn('w-full text-left p-2 rounded-lg border text-xs transition-all', activeVariation === i ? 'border-[#D4AF37]/35 bg-[#D4AF37]/8 text-white' : 'border-white/10 bg-white/3 text-gray-400 hover:text-white')}
                  >
                    <span className="font-medium">Variante {String.fromCharCode(65 + i)}</span> — {v.headline?.slice(0, 40)}...
                  </button>
                ))}
                {activeVariation !== null && (
                  <button type="button" onClick={() => setActiveVariation(null)} className="text-xs text-gray-500 hover:text-white transition-colors">
                    ← Version principale
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        <div>
          <p className="text-xs text-gray-400 mb-2">Aperçu</p>
          <AdPreviewCard
            platform={selectedPlatform}
            headline={displayContent.headline}
            description={displayContent.description}
            cta={displayContent.cta}
            hashtags={displayContent.hashtags}
            format={selectedFormat}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          onClick={() => saveCreative('draft')}
          disabled={saving || !adContent.headline}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white hover:bg-white/10 transition-all disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Sauvegarder brouillon
        </button>
        <button
          type="button"
          onClick={() => saveCreative('ready')}
          disabled={saving || !adContent.headline}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#e5c04a] transition-all disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          <Zap className="w-4 h-4" />
          Marquer comme prête
        </button>
        <button
          type="button"
          onClick={() => saveCreative('published')}
          disabled={saving || !adContent.headline}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-all disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          <Share2 className="w-4 h-4" />
          Publier
        </button>
      </div>
    </div>
  );

  const recapAside = (
    <>
      <div className="premium-panel space-y-2 p-4">
        <p className="text-xs uppercase tracking-wider text-gray-400">Récapitulatif</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Plateforme</span>
            <span className={cn('text-xs font-medium', currentPlatform.color)}>{currentPlatform.label}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Format</span>
            <span className="text-xs text-white">{FORMAT_LABELS[selectedFormat] || selectedFormat}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Objectif</span>
            <span className="text-xs text-white">{OBJECTIVES.find((o) => o.id === selectedObjective)?.label}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Source</span>
            <span className="text-xs text-white">
              {sourceType === 'manual' ? 'Texte libre' : sourceType === 'module' ? 'Module' : 'Clip'}
            </span>
          </div>
        </div>
      </div>

      <div className="premium-panel p-4">
        <p className="mb-3 text-xs uppercase tracking-wider text-gray-400">Conseils IA</p>
        <ul className="space-y-2">
          {[
            'Incluez un chiffre ou une statistique dans le titre',
            'Utilisez une accroche émotionnelle en première phrase',
            `Pour ${currentPlatform.label}, gardez le texte sous ${selectedPlatform === 'google' ? '90' : '125'} caractères`,
            'Testez 2-3 variantes pour identifier la plus performante',
          ].map((tip, i) => (
            <li key={i} className="flex gap-2 text-xs text-gray-400">
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[#D4AF37]" />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </>
  );

  const goPrevCreate = () => {
    if (step === 1 && adStep1Pane === 1) {
      setAdStep1Pane(0);
      return;
    }
    setStep((s) => Math.max(1, s - 1));
  };

  const goNextCreate = () => {
    if (step === 1 && adStep1Pane === 0) {
      setAdStep1Pane(1);
      return;
    }
    if (step === 2 && sourceTitle) void generateAdCopy();
    setStep((s) => Math.min(3, s + 1));
  };

  // ─── Tabs ───────────────────────────────────────────────────────────────────

  const TABS = [
    { id: 'create', label: 'Créer', icon: Sparkles },
    { id: 'channels', label: 'Canaux', icon: Link2 },
    { id: 'history', label: 'Mes pubs', icon: Film, badge: creatives.length || null },
  ];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#0a0908] text-white">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#D4AF37]/12 bg-[#0a0908]/95 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-3">
          <Link to="/studio" className="p-2 rounded-xl border border-white/10 hover:bg-white/5 transition-colors text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-base font-semibold tracking-tight text-white">
              <Megaphone className="h-5 w-5 shrink-0 text-[#D4AF37]" />
              <span className="truncate">Ad Creator Studio</span>
            </h1>
            <p className="text-xs text-gray-400">Créez et publiez des publicités IA multi-plateformes</p>
          </div>
        </div>
        <Link to="/admin/marketing?tab=analytics" className="text-xs text-[#D4AF37] border border-[#D4AF37]/25 rounded-lg px-3 py-1.5 hover:bg-[#D4AF37]/10 transition-colors flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5" /> Analytics
        </Link>
      </div>

      {/* Tabs */}
      <div className="shrink-0 border-b border-white/10 px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap',
                activeTab === t.id
                  ? 'border-[#D4AF37] text-[#D4AF37]'
                  : 'border-transparent text-gray-400 hover:text-white hover:border-white/20'
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.badge ? (
                <span className="ml-1 text-[10px] bg-[#D4AF37]/20 text-[#D4AF37] rounded-full px-1.5 py-0.5">{t.badge}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <Dialog open={recapOpen} onOpenChange={setRecapOpen}>
        <DialogContent className="max-h-[88dvh] max-w-md overflow-y-auto border-[#D4AF37]/25 bg-[#0a0908] text-white sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-left text-lg text-white">Récap &amp; conseils</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">{recapAside}</div>
        </DialogContent>
      </Dialog>

      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6">

        {/* ── TAB: Create ──────────────────────────────────────────────────────── */}
        {activeTab === 'create' && (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden xl:grid xl:grid-cols-3 xl:gap-6">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:col-span-2">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <StepDots step={step} total={3} />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRecapOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1.5 font-display text-[11px] font-semibold text-[#f5e6c8] transition-colors hover:bg-[#D4AF37]/18 xl:hidden"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    Récap
                  </button>
                  <div className="text-xs text-gray-400">
                    {step === 1 && 'Plateforme & objectif'}
                    {step === 2 && 'Source du contenu'}
                    {step === 3 && 'Contenu & publication'}
                  </div>
                </div>
              </div>

              {step === 1 && (
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex gap-1.5">
                    {[0, 1].map((i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`Écran ${i + 1} sur 2`}
                        aria-current={adStep1Pane === i ? 'step' : undefined}
                        onClick={() => setAdStep1Pane(i)}
                        className={cn(
                          'h-1.5 rounded-full transition-all',
                          adStep1Pane === i ? 'w-6 bg-[#D4AF37]' : 'w-1.5 bg-white/20 hover:bg-white/35',
                        )}
                      />
                    ))}
                  </div>
                  <span className="font-display text-[10px] text-gray-500">
                    Écran {adStep1Pane + 1}/2
                  </span>
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${step}-${step === 1 ? adStep1Pane : 'x'}`}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.2 }}
                  >
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-4 flex shrink-0 items-center justify-between gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={goPrevCreate}
                  disabled={step === 1 && adStep1Pane === 0}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-300 transition-all hover:bg-white/5 hover:text-white disabled:opacity-30"
                >
                  <ArrowLeft className="h-4 w-4" /> Précédent
                </button>
                {step < 3 ? (
                  <button
                    type="button"
                    onClick={goNextCreate}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-2 text-sm font-semibold text-black transition-all hover:bg-[#e5c04a]"
                  >
                    {step === 1 && adStep1Pane === 0 ? 'Écran suivant' : 'Suivant'}{' '}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="hidden min-h-0 space-y-4 overflow-y-auto overscroll-contain xl:block">
              {recapAside}
            </div>
          </div>
        )}

        {/* ── TAB: Channels ────────────────────────────────────────────────────── */}
        {activeTab === 'channels' && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-4 pr-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Canaux de vente & publicité</h2>
                <p className="text-sm text-gray-400 mt-1">Connectez vos plateformes pour automatiser la diffusion.</p>
              </div>
              {loadingChannels && <Loader2 className="w-5 h-5 animate-spin text-[#D4AF37]" />}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CHANNEL_CONFIGS.map((config) => (
                <ChannelCard
                  key={config.platform}
                  config={config}
                  integration={integrations[config.platform]}
                  onSave={saveChannelIntegration}
                />
              ))}
            </div>

            {/* Google Analytics snippet */}
            <div className="premium-panel p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-yellow-400" />
                Installation Google Analytics 4
              </h3>
              <p className="text-xs text-gray-400 mb-3">Ajoutez ce snippet dans le <code className="bg-black/30 px-1 rounded text-[#D4AF37]">&lt;head&gt;</code> de votre site après avoir configuré GA4 ci-dessus.</p>
              <div className="bg-[#0B1017] rounded-xl border border-white/8 p-4">
                <code className="text-xs text-green-300 block whitespace-pre">{`<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>`}</code>
              </div>
              <p className="text-xs text-gray-500 mt-2">Remplacez <code className="text-[#D4AF37]">G-XXXXXXXXXX</code> par votre Measurement ID ci-dessus.</p>
            </div>
          </div>
        )}

        {/* ── TAB: History ─────────────────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-4 pr-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Mes publicités</h2>
                <p className="text-sm text-gray-400 mt-1">{creatives.length} publicité{creatives.length !== 1 ? 's' : ''} sauvegardée{creatives.length !== 1 ? 's' : ''}.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={fetchHistory} className="p-2 rounded-xl border border-white/10 text-gray-400 hover:text-white transition-colors">
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setActiveTab('create')} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#e5c04a] transition-all">
                  <Plus className="w-4 h-4" /> Nouvelle pub
                </button>
              </div>
            </div>

            {loadingHistory ? (
              <div className="flex items-center gap-3 text-gray-400 py-8"><Loader2 className="w-5 h-5 animate-spin text-[#D4AF37]" /> Chargement...</div>
            ) : creatives.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-white/15 rounded-2xl">
                <Megaphone className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Aucune publicité créée pour l'instant.</p>
                <button type="button" onClick={() => setActiveTab('create')} className="mt-4 px-5 py-2 rounded-xl bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#e5c04a] transition-all">
                  Créer ma première pub
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {creatives.map((c) => {
                  const p = getPlatform(c.platform);
                  const statusColors = { draft: 'text-gray-400 bg-white/5 border-white/10', ready: 'text-blue-300 bg-blue-500/10 border-blue-500/25', published: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25', paused: 'text-amber-300 bg-amber-500/10 border-amber-500/25', archived: 'text-gray-500 bg-white/3 border-white/8' };
                  return (
                    <div key={c.id} className="premium-panel p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p.icon className={cn('w-4 h-4 shrink-0', p.color)} />
                          <p className="text-sm font-semibold text-white line-clamp-1">{c.title}</p>
                        </div>
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full border shrink-0', statusColors[c.status] || statusColors.draft)}>
                          {c.status === 'draft' ? 'Brouillon' : c.status === 'ready' ? 'Prête' : c.status === 'published' ? 'Publiée' : c.status === 'paused' ? 'En pause' : 'Archivée'}
                        </span>
                      </div>
                      {c.headline && <p className="text-xs text-gray-300 line-clamp-2">{c.headline}</p>}
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[10px] bg-white/5 text-gray-400 rounded px-1.5 py-0.5">{p.label}</span>
                        <span className="text-[10px] bg-white/5 text-gray-400 rounded px-1.5 py-0.5">{FORMAT_LABELS[c.format] || c.format}</span>
                        <span className="text-[10px] bg-white/5 text-gray-400 rounded px-1.5 py-0.5">{OBJECTIVES.find((o) => o.id === c.objective)?.label}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-500">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(c.created_at).toLocaleDateString('fr-FR')}</span>
                        {c.published_at && <span className="text-emerald-400">Publiée le {new Date(c.published_at).toLocaleDateString('fr-FR')}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
