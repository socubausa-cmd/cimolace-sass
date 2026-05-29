import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useFormations } from '@/hooks/useFormations';
import { useFormationStructure } from '@/hooks/useFormationStructure';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash, Search, BookOpen, Layers, AlertTriangle, MoreVertical, Copy, Archive, Image as ImageIcon, Sparkles } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

// Sub-components
import FormationDetailsPageView from '@/components/formations/FormationDetailsPageView';
import OwnerFormationBuilder from '@/components/formations/OwnerFormationBuilder';
import { SupabaseCoursePlayerContent } from '@/components/formations/CoursePlayerInterface';

const OwnerFormationsTab = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const didAutoOpenRef = useRef(false);
  const [viewMode, setViewMode] = useState('list'); // list, details, create, edit
  const [selectedFormation, setSelectedFormation] = useState(null);
  const [previewFormationId, setPreviewFormationId] = useState(null);
  const [structureLoading, setStructureLoading] = useState(false);
  const [structureLoadingId, setStructureLoadingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [alertConfig, setAlertConfig] = useState({ open: false, type: '', data: null });
  const { toast } = useToast();
  const [slowLoad, setSlowLoad] = useState(false);
  const slowLoadTimerRef = useRef(null);

  const {
    formations,
    loading,
    error,
    createFormation,
    updateFormation,
    deleteFormation,
    refresh,
  } = useFormations();

  const {
    fetchStructure,
    saveStructure,
  } = useFormationStructure();

  useEffect(() => {
    if (loading) {
      slowLoadTimerRef.current = window.setTimeout(() => setSlowLoad(true), 5000);
    } else {
      window.clearTimeout(slowLoadTimerRef.current);
      setSlowLoad(false);
    }
    return () => window.clearTimeout(slowLoadTimerRef.current);
  }, [loading]);

  const getEditFormationIdFromQuery = () => {
    try {
      const params = new URLSearchParams(location?.search || '');
      const v = params.get('editFormationId');
      return v && String(v).trim() ? String(v).trim() : null;
    } catch {
      return null;
    }
  };

  const pendingEditFormationId = getEditFormationIdFromQuery();

  useEffect(() => {
    if (didAutoOpenRef.current) return;
    if (loading) return;
    if (!formations || formations.length === 0) return;

    const editFormationId = getEditFormationIdFromQuery();
    if (!editFormationId) return;

    const found = formations.find((f) => String(f.id) === String(editFormationId));
    if (!found) return;

    didAutoOpenRef.current = true;
    // Switch to builder immediately to avoid flashing the formations list.
    setSelectedFormation(found);
    setViewMode('edit');

    openEdit(found).finally(() => {
      try {
        const params = new URLSearchParams(location?.search || '');
        params.delete('editFormationId');
        params.set('tab', 'formations');
        const next = params.toString();
        navigate(`/owner-dashboard${next ? `?${next}` : ''}`, { replace: true });
      } catch {
        navigate('/owner-dashboard?tab=formations', { replace: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, formations, location?.search]);

  useEffect(() => {
    if (loading) return;
    if (viewMode !== 'edit') return;
    if (!selectedFormation) return;
    const refreshed = formations.find((f) => f.id === selectedFormation.id);
    if (refreshed) {
      setSelectedFormation((prev) => {
        const prevModules = prev?.modules;
        const refreshedModules = refreshed?.modules;
        return {
          ...prev,
          ...refreshed,
          modules: Array.isArray(refreshedModules)
            ? refreshedModules
            : Array.isArray(prevModules)
              ? prevModules
              : [],
        };
      });
    }
  }, [formations, loading, selectedFormation, viewMode]);

  // Filter Logic
  const filteredFormations = formations.filter(f => {
    const matchesSearch = f.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || f.status === filterStatus;
    const matchesYear = filterYear === 'all' || f.year === filterYear;
    return matchesSearch && matchesStatus && matchesYear;
  });

  const formationStats = useMemo(() => {
    const total = formations.length;
    const published = formations.filter((f) => f.status === 'published').length;
    const draft = formations.filter((f) => f.status === 'draft').length;
    const archived = formations.filter((f) => f.status === 'archived').length;
    return { total, published, draft, archived };
  }, [formations]);

  const handleSaveFormation = async (formationData) => {
    try {
      if (viewMode === 'create') {
        const { data, error } = await createFormation({
          ...formationData,
          status: formationData?.status || 'draft',
        });
        if (error) {
          toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
          return false;
        }

        if (data?.id) {
          const { error: structErr } = await saveStructure(data.id, formationData?.modules || []);
          if (structErr) {
            toast({ title: 'Erreur', description: structErr.message, variant: 'destructive' });
            return false;
          }
        }
        toast({ title: 'Formation créée' });
      } else {
        const id = formationData?.id || selectedFormation?.id;
        const { error } = await updateFormation(id, formationData);
        if (error) {
          toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
          return false;
        }

        if (id) {
          const { error: structErr } = await saveStructure(id, formationData?.modules || []);
          if (structErr) {
            toast({ title: 'Erreur', description: structErr.message, variant: 'destructive' });
            return false;
          }
        }
        toast({ title: 'Formation mise à jour' });
      }
      setViewMode('list');
      setSelectedFormation(null);
      try {
        await refresh({ silent: true });
      } catch {
        // ignore
      }
      return true;
    } catch (e) {
      toast({ title: 'Erreur', description: String(e?.message || e), variant: 'destructive' });
      return false;
    }
  };

  const handleDelete = async () => {
    const id = alertConfig?.data?.id;
    if (!id) return;
    const { error } = await deleteFormation(id);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    setAlertConfig({ open: false, type: '', data: null });
    toast({ title: 'Formation supprimée', variant: 'destructive' });
  };

  const handleDuplicate = async (formation) => {
    const { error } = await createFormation({
      ...formation,
      id: undefined,
      title: `${formation.title} (Copie)`,
      status: 'draft',
    });
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Formation dupliquée', description: 'Une copie brouillon a été créée.' });
  };

  const handleArchive = async (formation) => {
    const newStatus = formation.status === 'archived' ? 'draft' : 'archived';
    const { error } = await updateFormation(formation.id, { status: newStatus });
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: newStatus === 'archived' ? 'Archivée' : 'Désarchivée' });
  };

  const handleSetStatus = async (formation, status) => {
    const { error } = await updateFormation(formation.id, { ...formation, status });
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: status === 'published' ? 'Formation publiée' : 'Formation mise en brouillon',
    });
  };

  const getAccessLabel = (formation) => {
    const mode = formation?.access_mode || formation?.meta?.access_mode || formation?.meta?.access?.mode || 'free';
    if (mode === 'subscription') return 'Abonnement';
    if (mode === 'one_time') return 'Vente module';
    return 'Gratuit';
  };

  const withTimeout = async (promise, ms, label) => {
    let t;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          t = window.setTimeout(() => reject(new Error(label)), ms);
        }),
      ]);
    } finally {
      if (t) window.clearTimeout(t);
    }
  };

  const openDetails = async (formation) => {
    if (!formation?.id || structureLoading) return;
    setStructureLoading(true);
    setStructureLoadingId(formation.id);
    try {
      const { data, error } = await withTimeout(fetchStructure(formation.id), 12000, 'structure_load_timeout');
      if (error) {
        toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
        return;
      }
      setSelectedFormation({ ...formation, modules: data || [] });
      setViewMode('details');
    } catch (e) {
      const msg = String(e?.message || e);
      toast({
        title: 'Chargement trop long',
        description: msg === 'structure_load_timeout' ? 'La structure met trop de temps à se charger. Réessaie.' : msg,
        variant: 'destructive',
      });
    } finally {
      setStructureLoading(false);
      setStructureLoadingId(null);
    }
  };

  const openEdit = async (formation) => {
    if (!formation?.id || structureLoading) return;
    setStructureLoading(true);
    setStructureLoadingId(formation.id);
    try {
      const { data, error } = await withTimeout(fetchStructure(formation.id), 12000, 'structure_load_timeout');
      if (error) {
        toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
        return;
      }
      setSelectedFormation({ ...formation, modules: data || [] });
      setViewMode('edit');
    } catch (e) {
      const msg = String(e?.message || e);
      toast({
        title: 'Chargement trop long',
        description: msg === 'structure_load_timeout' ? 'La structure met trop de temps à se charger. Réessaie.' : msg,
        variant: 'destructive',
      });
    } finally {
      setStructureLoading(false);
      setStructureLoadingId(null);
    }
  };

  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <OwnerFormationBuilder 
        formation={selectedFormation} 
        onSave={handleSaveFormation} 
        onCancel={() => { setViewMode('list'); setSelectedFormation(null); }} 
      />
    );
  }

  if (viewMode === 'details' && selectedFormation) {
    return (
      <>
        <FormationDetailsPageView
          formation={selectedFormation}
          onBack={() => { setViewMode('list'); setSelectedFormation(null); }}
          onEdit={() => openEdit(selectedFormation)}
          onPreview={() => setPreviewFormationId(selectedFormation.id)}
          isEditLoading={structureLoading && structureLoadingId === selectedFormation.id}
          isPreviewLoading={false}
        />
        <Dialog open={!!previewFormationId} onOpenChange={(open) => { if (!open) setPreviewFormationId(null); }}>
          <DialogContent className="max-w-[98vw] w-full h-[95vh] bg-[#0F1419] border-white/10 p-0 overflow-hidden [&>button]:hidden">
            <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-[#151a21]/95 backdrop-blur-xl border-b border-white/10">
              <span className="text-sm font-medium text-[#D4AF37]">Aperçu formation</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewFormationId(null)}
                className="text-gray-400 hover:text-white hover:bg-white/5"
              >
                Fermer
              </Button>
            </div>
            <div className="h-full pt-14 overflow-hidden">
              {previewFormationId ? (
                <SupabaseCoursePlayerContent
                  formationId={previewFormationId}
                  onExit={() => setPreviewFormationId(null)}
                />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (pendingEditFormationId && !didAutoOpenRef.current) {
    return (
      <div className="h-[60vh] flex items-center justify-center text-gray-300">
        Ouverture du constructeur…
      </div>
    );
  }

  return (
    <div className="relative min-h-[60vh]">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#D4AF37]/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[250px] h-[250px] bg-indigo-500/5 rounded-full blur-[80px]" />
      </div>

      <div className="space-y-6 relative">
      {/* Header Controls */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 p-5 rounded-2xl bg-[#151a21]/80 backdrop-blur-xl border border-white/10"
      >
        <div className="flex items-center gap-4 w-full xl:w-auto">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10"
          >
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-xs text-gray-400">Catalogue</span>
          </motion.div>
          <div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
              Mes Formations
            </h2>
            <Badge variant="outline" className="mt-1 text-[#D4AF37] border-[#D4AF37]/30 bg-[#D4AF37]/10">
              {formations.length} Total
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 w-full xl:w-auto flex-1 justify-end">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="relative w-full max-w-xs"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#0F1419]/80 backdrop-blur border-white/10 text-white"
            />
          </motion.div>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[140px] bg-[#0F1419]/80 backdrop-blur border-white/10 text-white">
              <SelectValue placeholder="Année" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes Années</SelectItem>
              <SelectItem value="1ère année">1ère année</SelectItem>
              <SelectItem value="2ème année">2ème année</SelectItem>
              <SelectItem value="3ème année">3ème année</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[120px] bg-[#0F1419]/80 backdrop-blur border-white/10 text-white">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="published">Publié</SelectItem>
              <SelectItem value="draft">Brouillon</SelectItem>
              <SelectItem value="archived">Archivé</SelectItem>
            </SelectContent>
          </Select>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={() => navigate('/studio')}
              variant="outline"
              className="border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 whitespace-nowrap"
            >
              <Sparkles className="h-4 w-4 mr-2" /> Studio Créateur
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={() => { setSelectedFormation(null); setViewMode('create'); }}
              className="bg-[#D4AF37] text-black hover:bg-amber-500 font-bold whitespace-nowrap shadow-lg shadow-[#D4AF37]/20"
            >
              <Plus className="h-4 w-4 mr-2" /> Créer
            </Button>
          </motion.div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total formations', value: formationStats.total, color: 'text-white' },
          { label: 'Publiees', value: formationStats.published, color: 'text-green-400' },
          { label: 'Brouillons', value: formationStats.draft, color: 'text-amber-400' },
          { label: 'Archivees', value: formationStats.archived, color: 'text-gray-300' },
        ].map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            whileHover={{ y: -2 }}
          >
            <Card className="premium-panel border-white/10">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">{item.label}</p>
                <p className={`text-2xl font-bold mt-1 ${item.color}`}>{item.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Grid View */}
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          {loading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-2xl overflow-hidden border border-white/10 bg-[#151a21]/60 backdrop-blur animate-pulse"
                >
                  <div className="h-48 bg-white/5" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-white/10 rounded w-3/4" />
                    <div className="h-3 bg-white/5 rounded w-1/2" />
                    <div className="flex gap-2 pt-4">
                      <div className="h-8 bg-white/5 rounded flex-1" />
                      <div className="h-8 bg-white/5 rounded flex-1" />
                      <div className="h-8 bg-white/5 rounded flex-1" />
                    </div>
                  </div>
                </motion.div>
              ))}
              {slowLoad && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-full text-center text-amber-400/80 text-sm pt-2 pb-4"
                >
                  Chargement toujours en cours (latence réseau ou serveur), merci de patienter…
                </motion.div>
              )}
            </>
          ) : null}
          {!loading && error ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="col-span-full flex flex-col items-center gap-4 py-14 text-center rounded-2xl border border-red-500/20 bg-red-500/5"
            >
              <AlertTriangle className="w-12 h-12 text-red-400" />
              <div className="text-red-300 font-semibold text-sm max-w-sm">
                {String(error?.message || error) === 'formations_load_timeout'
                  ? 'Délai dépassé en attendant Supabase. Ton projet peut être actif : causes fréquentes = connexion instable, antivirus/VPN (HTTPS), ou variables VITE_SUPABASE_* différentes entre build et le projet visé. Regarde l\'onglet Réseau (F12) sur les requêtes vers supabase.co, puis réessaie.'
                  : String(error?.message || error)}
              </div>
              <Button
                variant="outline"
                className="border-white/10 text-white hover:bg-white/5"
                onClick={() => refresh()}
              >
                Réessayer
              </Button>
            </motion.div>
          ) : null}
          {!loading && filteredFormations.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full text-center py-16 text-gray-500 rounded-2xl border border-dashed border-white/10 bg-white/5"
            >
              <BookOpen className="w-10 h-10 text-[#D4AF37] mx-auto mb-3" />
              <p className="text-white font-semibold">Aucune formation trouvée</p>
              <p className="text-sm text-gray-500 mt-1">Ajuste les filtres ou crée une nouvelle formation.</p>
              <Button
                className="mt-4 bg-[#D4AF37] text-black hover:bg-amber-500"
                onClick={() => { setSelectedFormation(null); setViewMode('create'); }}
              >
                <Plus className="w-4 h-4 mr-2" /> Créer une formation
              </Button>
            </motion.div>
          ) : null}
          {!loading &&
            filteredFormations.map((formation, index) => (
              <motion.div
                key={formation.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card
                  className="rounded-2xl overflow-hidden border border-white/10 bg-[#151a21]/80 backdrop-blur-xl hover:border-[#D4AF37]/40 transition-all group cursor-pointer"
                  onClick={() => openDetails(formation)}
                >
                  {/* Thumbnail Image */}
                  <div className="h-48 bg-gray-800 relative overflow-hidden">
                    {formation.thumbnail ? (
                      <motion.img
                        src={formation.thumbnail}
                        alt={formation.title}
                        className="w-full h-full object-cover"
                        whileHover={{ scale: 1.08 }}
                        transition={{ duration: 0.5 }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 bg-[#0F1419]">
                        <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                        <span className="text-xs">{formation.title}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#192734] via-transparent to-transparent" />
                    <div className="absolute top-3 right-3 flex gap-2">
                      <Badge className="bg-black/50 text-white backdrop-blur-xl border border-white/10">
                        {formation.year}
                      </Badge>
                      <Badge className="bg-black/50 text-[#D4AF37] backdrop-blur-xl border border-[#D4AF37]/30">
                        {getAccessLabel(formation)}
                      </Badge>
                    </div>
                    <div className="absolute bottom-3 left-3">
                      <Badge
                        className={
                          formation.status === 'published'
                            ? 'bg-emerald-500/90 text-black'
                            : formation.status === 'draft'
                              ? 'bg-amber-500/90 text-black'
                              : 'bg-gray-500/90 text-white'
                        }
                      >
                        {formation.status === 'published' ? 'Publié' : formation.status === 'draft' ? 'Brouillon' : 'Archivé'}
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-5">
                    <h3 className="text-lg font-bold text-white mb-2 line-clamp-1 group-hover:text-[#D4AF37] transition-colors" title={formation.title}>
                      {formation.title}
                    </h3>
                    <div className="flex items-center justify-between gap-3 text-sm text-gray-400 mb-4">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        <span className="text-xs">Structure</span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-300 hover:bg-white/5"
                            disabled={structureLoading && structureLoadingId === formation.id}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#192734] border-white/10">
                          {formation.status !== 'published' ? (
                            <DropdownMenuItem onClick={() => handleSetStatus(formation, 'published')}>
                              <BookOpen className="w-4 h-4 mr-2" /> Publier
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleSetStatus(formation, 'draft')}>
                              <BookOpen className="w-4 h-4 mr-2" /> Mettre en brouillon
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleDuplicate(formation)}>
                            <Copy className="w-4 h-4 mr-2" /> Dupliquer
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/studio/formation?editFormationId=${formation.id}`)}>
                            <Sparkles className="w-4 h-4 mr-2" /> Éditer dans Studio
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleArchive(formation)}>
                            <Archive className="w-4 h-4 mr-2" /> {formation.status === 'archived' ? 'Désarchiver' : 'Archiver'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setAlertConfig({ open: true, type: 'delete', data: formation })}
                            className="text-red-400 focus:text-red-400"
                          >
                            <Trash className="w-4 h-4 mr-2" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/5 text-center">
                      <span className="text-xs text-gray-500 group-hover:text-[#D4AF37]/80 transition-colors">
                        Cliquer pour voir les détails
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
        </motion.div>
      </AnimatePresence>
      </div>

      {/* Delete Confirmation */}
      <Dialog open={alertConfig.open} onOpenChange={(val) => !val && setAlertConfig({ ...alertConfig, open: false })}>
        <DialogContent className="bg-[#151a21]/95 backdrop-blur-xl border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500"><AlertTriangle className="h-5 w-5"/> Suppression irréversible</DialogTitle>
            <DialogDescription className="text-gray-400 pt-2">
              Êtes-vous sûr de vouloir supprimer la formation <strong>"{alertConfig.data?.title}"</strong> ? <br/>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setAlertConfig({ open: false })} className="text-gray-300">Annuler</Button>
            <Button variant="destructive" onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Supprimer définitivement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default OwnerFormationsTab;