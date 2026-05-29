/**
 * ═══════════════════════════════════════════════════════════════
 * MARKETING TOOLS SUITE — Dashboard complet pour les 6 outils
 * Réductions | Popups | Makeups | Snap | Proof | Bannières
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Percent,
  MessageSquare,
  LayoutTemplate,
  Smartphone,
  Users,
  PanelTop,
  TrendingUp,
  Plus,
  Settings,
  BarChart3,
  Copy,
  Check,
  ExternalLink,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Tag,
  Gift,
  Zap,
  Bell,
  Target,
  Timer,
  MoreHorizontal,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  X,
  CheckCircle2,
  AlertCircle,
  Code,
  Palette,
  MousePointer,
  Sparkles,
  Megaphone,
  ShoppingBag,
  CreditCard,
  Mail,
  Phone,
  User,
  Globe,
  Clock,
  Calendar,
  Hash,
  Lock,
  Unlock,
  Layers,
  Image,
  Type,
  AlignLeft,
  Palette as PaletteIcon,
  Smartphone as MobileIcon,
  Monitor,
  Tablet,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import { resolveNetlifyApiUrl } from '@/lib/resolveNetlifyApiUrl';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Tool cards configuration
const TOOLS = [
  {
    id: 'discounts',
    title: 'Réductions',
    description: 'Créez des codes promo et offres de remise pour stimuler vos ventes.',
    icon: Percent,
    color: '#10b981',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    textColor: 'text-emerald-600',
    stats: ['discounts'],
  },
  {
    id: 'popups',
    title: 'Popups',
    description: 'Capturez l\'attention avec des modals contextuels et animés.',
    icon: MessageSquare,
    color: '#8b5cf6',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
    textColor: 'text-violet-600',
    stats: ['popups'],
  },
  {
    id: 'makeups',
    title: 'Makeups',
    description: 'Créez des pages de vente qui convertissent vos visiteurs en clients.',
    icon: LayoutTemplate,
    color: '#3b82f6',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    textColor: 'text-blue-600',
    new: true,
    stats: ['makeups'],
  },
  {
    id: 'snap',
    title: 'Snap',
    description: 'Intégrez le widget Chariow pour le chat et la conversion instantanée.',
    icon: Smartphone,
    color: '#f59e0b',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    textColor: 'text-amber-600',
    new: true,
    stats: ['conversations'],
  },
  {
    id: 'proof',
    title: 'Proof',
    description: 'Affichez les avis clients et notifications d\'achat en temps réel.',
    icon: Users,
    color: '#ec4899',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/20',
    textColor: 'text-pink-600',
    new: true,
    stats: ['proof_events'],
  },
  {
    id: 'banners',
    title: 'Bannières',
    description: 'Diffusez des messages promotionnels en haut ou bas de votre boutique.',
    icon: PanelTop,
    color: '#06b6d4',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    textColor: 'text-cyan-600',
    stats: ['banners'],
  },
];

export default function MarketingToolsSuitePage() {
  const { toast } = useToast();
  const [activeTool, setActiveTool] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    active_discounts: 0,
    active_popups: 0,
    published_makeups: 0,
    active_banners: 0,
    active_conversations: 0,
    recent_proof_events: 0,
    new_leads: 0,
  });

  // Tool data states
  const [discounts, setDiscounts] = useState([]);
  const [popups, setPopups] = useState([]);
  const [makeups, setMakeups] = useState([]);
  const [banners, setBanners] = useState([]);
  const [snapConfig, setSnapConfig] = useState(null);
  const [proofConfig, setProofConfig] = useState(null);

  // Modal states
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showPopupModal, setShowPopupModal] = useState(false);
  const [showMakeupModal, setShowMakeupModal] = useState(false);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [showSnapModal, setShowSnapModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);

  // Auth fetch helper
  const authFetch = async (url, options = {}) => {
    const { data: sessData } = await supabase.auth.getSession();
    const token = sessData?.session?.access_token;
    if (!token) throw new Error('Session invalide');
    const resolved = resolveNetlifyApiUrl(url);
    const res = await fetch(resolved, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload?.error || 'Erreur API');
    return payload;
  };

  // Load dashboard data
  const loadDashboardData = async () => {
    try {
      const dashboardRes = await authFetch('/api/marketing/admin/dashboard');
      if (dashboardRes.stats) {
        setStats(dashboardRes.stats);
      }
    } catch (e) {
      console.warn('Dashboard stats error:', e);
    }
  };

  // Load all tools data
  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadDashboardData(),
        loadDiscounts(),
        loadPopups(),
        loadMakeups(),
        loadBanners(),
        loadSnapConfig(),
        loadProofConfig(),
      ]);
    } catch (e) {
      toast({
        title: 'Erreur de chargement',
        description: String(e?.message || e),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDiscounts = async () => {
    try {
      const res = await authFetch('/api/marketing/admin/discounts');
      setDiscounts(res.discounts || []);
    } catch (e) {
      console.warn('Load discounts error:', e);
    }
  };

  const loadPopups = async () => {
    try {
      const res = await authFetch('/api/marketing/admin/popups');
      setPopups(res.popups || []);
    } catch (e) {
      console.warn('Load popups error:', e);
    }
  };

  const loadMakeups = async () => {
    try {
      const res = await authFetch('/api/marketing/admin/makeups');
      setMakeups(res.makeups || []);
    } catch (e) {
      console.warn('Load makeups error:', e);
    }
  };

  const loadBanners = async () => {
    try {
      const res = await authFetch('/api/marketing/admin/banners');
      setBanners(res.banners || []);
    } catch (e) {
      console.warn('Load banners error:', e);
    }
  };

  const loadSnapConfig = async () => {
    try {
      const res = await authFetch('/api/marketing/snap/config');
      setSnapConfig(res.config);
    } catch (e) {
      console.warn('Load snap config error:', e);
    }
  };

  const loadProofConfig = async () => {
    try {
      const res = await authFetch('/api/marketing/proof/config');
      setProofConfig(res.config);
    } catch (e) {
      console.warn('Load proof config error:', e);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Create functions
  const createDiscount = async (data) => {
    try {
      await authFetch('/api/marketing/admin/discounts', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      toast({ title: 'Code promo créé', description: `${data.code} est maintenant actif.` });
      setShowDiscountModal(false);
      loadDiscounts();
    } catch (e) {
      toast({ title: 'Erreur', description: String(e?.message || e), variant: 'destructive' });
    }
  };

  const createPopup = async (data) => {
    try {
      await authFetch('/api/marketing/admin/popups', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      toast({ title: 'Popup créé', description: `${data.name} est maintenant actif.` });
      setShowPopupModal(false);
      loadPopups();
    } catch (e) {
      toast({ title: 'Erreur', description: String(e?.message || e), variant: 'destructive' });
    }
  };

  const createMakeup = async (data) => {
    try {
      await authFetch('/api/marketing/admin/makeups', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      toast({ title: 'Landing page créée', description: `${data.name} est maintenant en ligne.` });
      setShowMakeupModal(false);
      loadMakeups();
    } catch (e) {
      toast({ title: 'Erreur', description: String(e?.message || e), variant: 'destructive' });
    }
  };

  const createBanner = async (data) => {
    try {
      await authFetch('/api/marketing/admin/banners', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      toast({ title: 'Bannière créée', description: 'Elle est maintenant visible sur votre site.' });
      setShowBannerModal(false);
      loadBanners();
    } catch (e) {
      toast({ title: 'Erreur', description: String(e?.message || e), variant: 'destructive' });
    }
  };

  // Format date helper
  const formatDate = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Status badge helper
  const StatusBadge = ({ status }) => {
    const styles = {
      active: 'bg-emerald-100 text-emerald-700',
      published: 'bg-emerald-100 text-emerald-700',
      inactive: 'bg-gray-100 text-gray-600',
      draft: 'bg-amber-100 text-amber-700',
      archived: 'bg-gray-100 text-gray-500',
      pending: 'bg-blue-100 text-blue-700',
    };
    const labels = {
      active: 'Actif',
      published: 'Publié',
      inactive: 'Inactif',
      draft: 'Brouillon',
      archived: 'Archivé',
      pending: 'En attente',
    };
    return (
      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', styles[status] || styles.inactive)}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-20">
      <Helmet>
        <title>Outils Marketing | ISNA-PRORASCIENCE</title>
      </Helmet>

      {/* Header */}
      <div className="bg-white border-b border-[#e5e5ea] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#0a0a0f]">Marketing</h1>
              <p className="text-sm text-[#6e6e73]">
                Boostez vos ventes avec des outils marketing puissants et faciles à utiliser
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                to="/admin/marketing"
                className="px-4 py-2 text-sm font-medium text-[#6e6e73] hover:text-[#0a0a0f] transition-colors"
              >
                Ancienne version
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          {[
            { label: 'Réductions', value: stats.active_discounts, icon: Percent, color: '#10b981' },
            { label: 'Popups', value: stats.active_popups, icon: MessageSquare, color: '#8b5cf6' },
            { label: 'Makeups', value: stats.published_makeups, icon: LayoutTemplate, color: '#3b82f6' },
            { label: 'Bannières', value: stats.active_banners, icon: PanelTop, color: '#06b6d4' },
            { label: 'Conversations', value: stats.active_conversations, icon: Smartphone, color: '#f59e0b' },
            { label: 'Proof events', value: stats.recent_proof_events, icon: Users, color: '#ec4899' },
            { label: 'Nouveaux leads', value: stats.new_leads, icon: Target, color: '#5b3df5' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl p-4 border border-[#e5e5ea] hover:border-[#d1d1d6] transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                <span className="text-xs text-[#6e6e73]">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-[#0a0a0f]">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOOLS.map((tool) => (
            <motion.div
              key={tool.id}
              whileHover={{ y: -2 }}
              className={cn(
                'bg-white rounded-xl border p-5 cursor-pointer transition-all',
                tool.borderColor,
                activeTool === tool.id ? 'ring-2 ring-offset-2' : 'hover:shadow-lg'
              )}
              style={{ ringColor: tool.color }}
              onClick={() => setActiveTool(tool.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={cn('w-12 h-12 rounded-xl flex items-center justify-center', tool.bgColor)}
                >
                  <tool.icon className={cn('w-6 h-6', tool.textColor)} />
                </div>
                <div className="flex items-center gap-2">
                  {tool.new && (
                    <Badge className="bg-red-500 text-white text-[10px]">Nouveau</Badge>
                  )}
                  <ChevronRight className="w-5 h-5 text-[#6e6e73]" />
                </div>
              </div>
              <h3 className="font-semibold text-[#0a0a0f] mb-1">{tool.title}</h3>
              <p className="text-sm text-[#6e6e73] line-clamp-2">{tool.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Active Tool Content */}
        <AnimatePresence mode="wait">
          {activeTool !== 'overview' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8"
            >
              {/* Discounts Panel */}
              {activeTool === 'discounts' && (
                <div className="bg-white rounded-xl border border-[#e5e5ea] overflow-hidden">
                  <div className="p-5 border-b border-[#e5e5ea] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <Percent className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <h2 className="font-semibold text-[#0a0a0f]">Réductions</h2>
                        <p className="text-sm text-[#6e6e73]">Gérez vos codes promo et offres</p>
                      </div>
                    </div>
                    <Button onClick={() => setShowDiscountModal(true)} className="bg-emerald-600 hover:bg-emerald-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Nouveau code
                    </Button>
                  </div>

                  <div className="p-5">
                    {discounts.length === 0 ? (
                      <div className="text-center py-12">
                        <Percent className="w-12 h-12 text-[#e5e5ea] mx-auto mb-4" />
                        <p className="text-[#6e6e73]">Aucun code promo actif</p>
                        <Button
                          variant="outline"
                          className="mt-4"
                          onClick={() => setShowDiscountModal(true)}
                        >
                          Créer votre premier code
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {discounts.map((discount) => (
                          <div
                            key={discount.id}
                            className="flex items-center justify-between p-4 bg-[#f5f5f7] rounded-lg"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                                <Tag className="w-5 h-5 text-emerald-600" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-[#0a0a0f]">{discount.name}</p>
                                  <code className="px-2 py-0.5 bg-[#0a0a0f] text-white text-xs rounded">
                                    {discount.code}
                                  </code>
                                </div>
                                <p className="text-sm text-[#6e6e73]">
                                  {discount.discount_type === 'percentage'
                                    ? `${discount.discount_value}% de réduction`
                                    : `${discount.discount_value}€ de remise`}
                                  {discount.max_discount_amount && ` (max ${discount.max_discount_amount}€)`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <StatusBadge status={discount.is_active ? 'active' : 'inactive'} />
                              <p className="text-sm text-[#6e6e73]">
                                {discount.current_uses || 0} utilisations
                              </p>
                              <Button variant="ghost" size="sm">
                                <Edit3 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Popups Panel */}
              {activeTool === 'popups' && (
                <div className="bg-white rounded-xl border border-[#e5e5ea] overflow-hidden">
                  <div className="p-5 border-b border-[#e5e5ea] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-violet-600" />
                      </div>
                      <div>
                        <h2 className="font-semibold text-[#0a0a0f]">Popups</h2>
                        <p className="text-sm text-[#6e6e73]">Gérez vos modals marketing</p>
                      </div>
                    </div>
                    <Button onClick={() => setShowPopupModal(true)} className="bg-violet-600 hover:bg-violet-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Nouveau popup
                    </Button>
                  </div>

                  <div className="p-5">
                    {popups.length === 0 ? (
                      <div className="text-center py-12">
                        <MessageSquare className="w-12 h-12 text-[#e5e5ea] mx-auto mb-4" />
                        <p className="text-[#6e6e73]">Aucun popup actif</p>
                        <Button
                          variant="outline"
                          className="mt-4"
                          onClick={() => setShowPopupModal(true)}
                        >
                          Créer votre premier popup
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {popups.map((popup) => (
                          <div
                            key={popup.id}
                            className="flex items-center justify-between p-4 bg-[#f5f5f7] rounded-lg"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-violet-500/10 rounded-lg flex items-center justify-center">
                                <Bell className="w-5 h-5 text-violet-600" />
                              </div>
                              <div>
                                <p className="font-medium text-[#0a0a0f]">{popup.name}</p>
                                <p className="text-sm text-[#6e6e73]">
                                  {popup.template} • {popup.trigger_type}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right text-sm">
                                <p className="text-[#6e6e73]">{popup.impressions || 0} vues</p>
                                <p className="text-[#6e6e73]">{popup.clicks || 0} clics</p>
                              </div>
                              <StatusBadge status={popup.is_active ? 'active' : 'inactive'} />
                              <Button variant="ghost" size="sm">
                                <Edit3 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Makeups Panel */}
              {activeTool === 'makeups' && (
                <div className="bg-white rounded-xl border border-[#e5e5ea] overflow-hidden">
                  <div className="p-5 border-b border-[#e5e5ea] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <LayoutTemplate className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h2 className="font-semibold text-[#0a0a0f]">Makeups</h2>
                        <p className="text-sm text-[#6e6e73]">Vos pages de vente et landing pages</p>
                      </div>
                    </div>
                    <Button onClick={() => setShowMakeupModal(true)} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Nouvelle page
                    </Button>
                  </div>

                  <div className="p-5">
                    {makeups.length === 0 ? (
                      <div className="text-center py-12">
                        <LayoutTemplate className="w-12 h-12 text-[#e5e5ea] mx-auto mb-4" />
                        <p className="text-[#6e6e73]">Aucune landing page</p>
                        <Button
                          variant="outline"
                          className="mt-4"
                          onClick={() => setShowMakeupModal(true)}
                        >
                          Créer votre première page
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {makeups.map((makeup) => (
                          <div
                            key={makeup.id}
                            className="p-4 bg-[#f5f5f7] rounded-lg"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                                  <Globe className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                  <p className="font-medium text-[#0a0a0f]">{makeup.name}</p>
                                  <code className="text-xs text-[#6e6e73]">/{makeup.slug}</code>
                                </div>
                              </div>
                              <StatusBadge status={makeup.status} />
                            </div>
                            <div className="flex items-center gap-4 text-sm text-[#6e6e73] mb-3">
                              <span>{makeup.views || 0} vues</span>
                              <span>{makeup.leads || 0} leads</span>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="flex-1">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Voir
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Edit3 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Banners Panel */}
              {activeTool === 'banners' && (
                <div className="bg-white rounded-xl border border-[#e5e5ea] overflow-hidden">
                  <div className="p-5 border-b border-[#e5e5ea] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                        <PanelTop className="w-5 h-5 text-cyan-600" />
                      </div>
                      <div>
                        <h2 className="font-semibold text-[#0a0a0f]">Bannières</h2>
                        <p className="text-sm text-[#6e6e73]">Messages promotionnels en haut/bas de page</p>
                      </div>
                    </div>
                    <Button onClick={() => setShowBannerModal(true)} className="bg-cyan-600 hover:bg-cyan-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Nouvelle bannière
                    </Button>
                  </div>

                  <div className="p-5">
                    {banners.length === 0 ? (
                      <div className="text-center py-12">
                        <PanelTop className="w-12 h-12 text-[#e5e5ea] mx-auto mb-4" />
                        <p className="text-[#6e6e73]">Aucune bannière active</p>
                        <Button
                          variant="outline"
                          className="mt-4"
                          onClick={() => setShowBannerModal(true)}
                        >
                          Créer votre première bannière
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {banners.map((banner) => (
                          <div
                            key={banner.id}
                            className="p-4 rounded-lg"
                            style={{ backgroundColor: banner.background_color, color: banner.text_color }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <p className="font-medium">{banner.content}</p>
                                {banner.cta_text && (
                                  <Badge style={{ backgroundColor: banner.accent_color }}>
                                    {banner.cta_text}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm opacity-75">{banner.position}</span>
                                <Button variant="ghost" size="sm" className="text-current">
                                  <Edit3 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Snap Panel */}
              {activeTool === 'snap' && (
                <div className="bg-white rounded-xl border border-[#e5e5ea] overflow-hidden">
                  <div className="p-5 border-b border-[#e5e5ea] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <h2 className="font-semibold text-[#0a0a0f]">Snap</h2>
                        <p className="text-sm text-[#6e6e73]">Widget chat Chariow</p>
                      </div>
                    </div>
                    <Button onClick={() => setShowSnapModal(true)} className="bg-amber-600 hover:bg-amber-700">
                      <Settings className="w-4 h-4 mr-2" />
                      Configurer
                    </Button>
                  </div>

                  <div className="p-5">
                    {snapConfig ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="p-4 bg-[#f5f5f7] rounded-lg">
                            <p className="text-sm font-medium text-[#6e6e73] mb-1">Position</p>
                            <p className="text-[#0a0a0f]">{snapConfig.widget_position}</p>
                          </div>
                          <div className="p-4 bg-[#f5f5f7] rounded-lg">
                            <p className="text-sm font-medium text-[#6e6e73] mb-1">Message d'accueil</p>
                            <p className="text-[#0a0a0f]">{snapConfig.welcome_message}</p>
                          </div>
                          <div className="p-4 bg-[#f5f5f7] rounded-lg">
                            <p className="text-sm font-medium text-[#6e6e73] mb-1">Statistiques</p>
                            <div className="flex gap-4 text-sm">
                              <span>{snapConfig.conversations_count || 0} conversations</span>
                              <span>{snapConfig.leads_generated || 0} leads</span>
                            </div>
                          </div>
                        </div>
                        <div className="border-2 border-dashed border-[#e5e5ea] rounded-xl flex items-center justify-center p-8">
                          <div className="text-center">
                            <Smartphone className="w-12 h-12 text-[#e5e5ea] mx-auto mb-4" />
                            <p className="text-sm text-[#6e6e73]">Prévisualisation du widget</p>
                            <Button variant="outline" size="sm" className="mt-4">
                              <Code className="w-4 h-4 mr-2" />
                              Voir le code d'intégration
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Smartphone className="w-12 h-12 text-[#e5e5ea] mx-auto mb-4" />
                        <p className="text-[#6e6e73]">Snap n'est pas encore configuré</p>
                        <Button
                          className="mt-4 bg-amber-600 hover:bg-amber-700"
                          onClick={() => setShowSnapModal(true)}
                        >
                          Configurer Snap
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Proof Panel */}
              {activeTool === 'proof' && (
                <div className="bg-white rounded-xl border border-[#e5e5ea] overflow-hidden">
                  <div className="p-5 border-b border-[#e5e5ea] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-pink-600" />
                      </div>
                      <div>
                        <h2 className="font-semibold text-[#0a0a0f]">Proof</h2>
                        <p className="text-sm text-[#6e6e73]">Preuve sociale et notifications</p>
                      </div>
                    </div>
                    <Button onClick={() => setShowProofModal(true)} className="bg-pink-600 hover:bg-pink-700">
                      <Settings className="w-4 h-4 mr-2" />
                      Configurer
                    </Button>
                  </div>

                  <div className="p-5">
                    {proofConfig ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="p-4 bg-[#f5f5f7] rounded-lg text-center">
                            <p className="text-2xl font-bold text-[#0a0a0f]">{proofConfig.show_purchases ? '✓' : '—'}</p>
                            <p className="text-sm text-[#6e6e73]">Achats</p>
                          </div>
                          <div className="p-4 bg-[#f5f5f7] rounded-lg text-center">
                            <p className="text-2xl font-bold text-[#0a0a0f]">{proofConfig.show_signups ? '✓' : '—'}</p>
                            <p className="text-sm text-[#6e6e73]">Inscriptions</p>
                          </div>
                          <div className="p-4 bg-[#f5f5f7] rounded-lg text-center">
                            <p className="text-2xl font-bold text-[#0a0a0f]">{proofConfig.show_reviews ? '✓' : '—'}</p>
                            <p className="text-sm text-[#6e6e73]">Avis</p>
                          </div>
                        </div>
                        <div className="p-4 bg-[#f5f5f7] rounded-lg">
                          <p className="text-sm font-medium text-[#6e6e73] mb-2">Configuration</p>
                          <div className="space-y-1 text-sm">
                            <p>Position: {proofConfig.position}</p>
                            <p>Durée d'affichage: {proofConfig.display_duration}s</p>
                            <p>Délai entre notifications: {proofConfig.delay_between}s</p>
                            <p>Source: {proofConfig.data_source}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Users className="w-12 h-12 text-[#e5e5ea] mx-auto mb-4" />
                        <p className="text-[#6e6e73]">Proof n'est pas encore configuré</p>
                        <Button
                          className="mt-4 bg-pink-600 hover:bg-pink-700"
                          onClick={() => setShowProofModal(true)}
                        >
                          Configurer Proof
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals would be defined here - keeping them simple for now */}
      {showDiscountModal && (
        <DiscountModal onClose={() => setShowDiscountModal(false)} onSave={createDiscount} />
      )}
      {showPopupModal && (
        <PopupModal onClose={() => setShowPopupModal(false)} onSave={createPopup} />
      )}
      {showMakeupModal && (
        <MakeupModal onClose={() => setShowMakeupModal(false)} onSave={createMakeup} />
      )}
      {showBannerModal && (
        <BannerModal onClose={() => setShowBannerModal(false)} onSave={createBanner} />
      )}
    </div>
  );
}

// Simple modals for each tool
function DiscountModal({ onClose, onSave }) {
  const [data, setData] = useState({
    code: '',
    name: '',
    description: '',
    discount_type: 'percentage',
    discount_value: 10,
    min_order_amount: 0,
    max_discount_amount: '',
    max_uses: '',
    max_uses_per_user: 1,
    start_date: '',
    end_date: '',
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-auto">
        <div className="p-5 border-b border-[#e5e5ea] flex items-center justify-between">
          <h3 className="font-semibold text-[#0a0a0f]">Nouveau code promo</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#6e6e73] mb-1">Code</label>
            <input
              type="text"
              value={data.code}
              onChange={(e) => setData({ ...data, code: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg"
              placeholder="PROMO20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#6e6e73] mb-1">Nom</label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg"
              placeholder="Promotion de printemps"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#6e6e73] mb-1">Type</label>
              <select
                value={data.discount_type}
                onChange={(e) => setData({ ...data, discount_type: e.target.value })}
                className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg"
              >
                <option value="percentage">Pourcentage (%)</option>
                <option value="fixed_amount">Montant fixe (€)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#6e6e73] mb-1">Valeur</label>
              <input
                type="number"
                value={data.discount_value}
                onChange={(e) => setData({ ...data, discount_value: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg"
              />
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-[#e5e5ea] flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => onSave(data)} className="bg-emerald-600 hover:bg-emerald-700">
            Créer le code
          </Button>
        </div>
      </div>
    </div>
  );
}

function PopupModal({ onClose, onSave }) {
  const [data, setData] = useState({
    name: '',
    title: '',
    subtitle: '',
    content: '',
    cta_text: 'Valider',
    template: 'center_modal',
    trigger_type: 'delay',
    trigger_value: 5,
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-auto">
        <div className="p-5 border-b border-[#e5e5ea] flex items-center justify-between">
          <h3 className="font-semibold text-[#0a0a0f]">Nouveau popup</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#6e6e73] mb-1">Nom</label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#6e6e73] mb-1">Titre</label>
            <input
              type="text"
              value={data.title}
              onChange={(e) => setData({ ...data, title: e.target.value })}
              className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#6e6e73] mb-1">Template</label>
            <select
              value={data.template}
              onChange={(e) => setData({ ...data, template: e.target.value })}
              className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg"
            >
              <option value="center_modal">Modal centré</option>
              <option value="bottom_sheet">Sheet du bas</option>
              <option value="side_panel">Panneau latéral</option>
              <option value="banner_top">Bannière haut</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#6e6e73] mb-1">Trigger</label>
              <select
                value={data.trigger_type}
                onChange={(e) => setData({ ...data, trigger_type: e.target.value })}
                className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg"
              >
                <option value="immediate">Immédiat</option>
                <option value="delay">Délai</option>
                <option value="scroll">Scroll</option>
                <option value="exit_intent">Exit intent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#6e6e73] mb-1">Valeur (sec/%)</label>
              <input
                type="number"
                value={data.trigger_value}
                onChange={(e) => setData({ ...data, trigger_value: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg"
              />
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-[#e5e5ea] flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => onSave(data)} className="bg-violet-600 hover:bg-violet-700">
            Créer le popup
          </Button>
        </div>
      </div>
    </div>
  );
}

function MakeupModal({ onClose, onSave }) {
  const [data, setData] = useState({
    name: '',
    slug: '',
    page_type: 'landing',
    meta_title: '',
    meta_description: '',
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-auto">
        <div className="p-5 border-b border-[#e5e5ea] flex items-center justify-between">
          <h3 className="font-semibold text-[#0a0a0f]">Nouvelle landing page</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#6e6e73] mb-1">Nom</label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#6e6e73] mb-1">Slug (URL)</label>
            <input
              type="text"
              value={data.slug}
              onChange={(e) => setData({ ...data, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
              className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg"
              placeholder="ma-page-vente"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#6e6e73] mb-1">Type</label>
            <select
              value={data.page_type}
              onChange={(e) => setData({ ...data, page_type: e.target.value })}
              className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg"
            >
              <option value="landing">Landing page</option>
              <option value="sales">Page de vente</option>
              <option value="webinar">Webinar</option>
              <option value="event">Événement</option>
              <option value="waitlist">Liste d'attente</option>
            </select>
          </div>
        </div>
        <div className="p-5 border-t border-[#e5e5ea] flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => onSave(data)} className="bg-blue-600 hover:bg-blue-700">
            Créer la page
          </Button>
        </div>
      </div>
    </div>
  );
}

function BannerModal({ onClose, onSave }) {
  const [data, setData] = useState({
    name: '',
    content: '',
    cta_text: '',
    position: 'top',
    background_color: '#5b3df5',
    text_color: '#ffffff',
    accent_color: '#D4AF37',
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-auto">
        <div className="p-5 border-b border-[#e5e5ea] flex items-center justify-between">
          <h3 className="font-semibold text-[#0a0a0f]">Nouvelle bannière</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#6e6e73] mb-1">Nom</label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#6e6e73] mb-1">Message</label>
            <textarea
              value={data.content}
              onChange={(e) => setData({ ...data, content: e.target.value })}
              className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#6e6e73] mb-1">Position</label>
              <select
                value={data.position}
                onChange={(e) => setData({ ...data, position: e.target.value })}
                className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg"
              >
                <option value="top">Haut</option>
                <option value="bottom">Bas</option>
                <option value="floating">Flottante</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#6e6e73] mb-1">CTA</label>
              <input
                type="text"
                value={data.cta_text}
                onChange={(e) => setData({ ...data, cta_text: e.target.value })}
                className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg"
                placeholder="En savoir plus"
              />
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-[#e5e5ea] flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => onSave(data)} className="bg-cyan-600 hover:bg-cyan-700">
            Créer la bannière
          </Button>
        </div>
      </div>
    </div>
  );
}
