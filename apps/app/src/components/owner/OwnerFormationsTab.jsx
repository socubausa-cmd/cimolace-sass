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
import { Plus, Trash, Search, BookOpen, Layers, AlertTriangle, MoreVertical, Copy, Archive, Sparkles, LayoutGrid, List } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

// Sub-components
import FormationDetailsPageView from '@/components/school/formations/FormationDetailsPageView';
import OwnerFormationBuilder from '@/components/school/formations/OwnerFormationBuilder';
import { SupabaseCoursePlayerContent } from '@/components/school/formations/CoursePlayerInterface';

// Couverture générée quand la formation n'a pas de visuel : aplat CHAUD dérivé du titre
// (stable d'un rendu à l'autre) + initiales — jamais d'icône d'image cassée ni de titre
// affiché deux fois. Tons volontairement sombres pour garder l'encre claire lisible
// (≥ 4,5:1) quel que soit le thème de la coque hôte.
const COVER_TONES = ['#7a4a33', '#84502e', '#6d4a3a', '#8a4630', '#5f4a35', '#75402f'];
const coverToneFor = (title) => {
  let h = 0;
  for (const ch of String(title || '')) h = ((h * 31) + ch.charCodeAt(0)) >>> 0;
  return COVER_TONES[h % COVER_TONES.length];
};
const coverInitialsFor = (title) => {
  const words = String(title || '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3);
  const letters = (words.length ? words : [String(title || '?')]).slice(0, 2).map((w) => w[0]);
  return letters.join('').toUpperCase() || '?';
};

const formatDateFr = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

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
  // Bascule grille/liste mémorisée : avec 33 brouillons, la liste compacte (titre,
  // statut, prix, date) est le seul moyen de distinguer les copies homonymes.
  const [displayMode, setDisplayMode] = useState(() => {
    try {
      return localStorage.getItem('owner-formations-display') === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });
  const setDisplayModePersist = (mode) => {
    setDisplayMode(mode);
    try { localStorage.setItem('owner-formations-display', mode); } catch { /* stockage indisponible : la bascule reste en mémoire */ }
  };
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
        // Reste sur la route COURANTE (ex. /liri/ecole), pas le chemin pré-migration
        // '/owner-dashboard' codé en dur : sinon la redirection legacy démonte/remonte
        // toute la coque LIRI (flash) et jette l'éditeur qu'on vient d'ouvrir.
        navigate(`${location.pathname}${next ? `?${next}` : ''}`, { replace: true });
      } catch {
        navigate(`${location.pathname}?tab=formations`, { replace: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, formations, location?.search]);

  // Re-sync de la formation en cours d'édition après un refetch de la liste.
  // ⚠️ Anti-boucle React #185 (« Maximum update depth exceeded ») : on ne traite
  // chaque RÉFÉRENCE de `formations` qu'UNE fois (syncedFormationsRef), et on lit la
  // formation courante via le updater (prev) au lieu de la mettre en dépendance.
  // Avant : setSelectedFormation créait un nouvel objet → selectedFormation changeait
  // → l'effet (qui l'avait en dep) se redéclenchait à l'infini → crash #185.
  const syncedFormationsRef = useRef(null);
  useEffect(() => {
    if (loading) return;
    if (viewMode !== 'edit') return;
    if (syncedFormationsRef.current === formations) return;
    syncedFormationsRef.current = formations;
    setSelectedFormation((prev) => {
      if (!prev) return prev;
      const refreshed = formations.find((f) => f.id === prev.id);
      if (!refreshed) return prev;
      const nextModules = Array.isArray(refreshed.modules)
        ? refreshed.modules
        : Array.isArray(prev.modules)
          ? prev.modules
          : [];
      return { ...prev, ...refreshed, modules: nextModules };
    });
    // selectedFormation volontairement HORS des deps (lu via prev) — voir note anti-boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formations, loading, viewMode]);

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

  // Le chip « Archivées » disparaît quand il n'y a plus rien à filtrer : on ne doit
  // pas laisser l'utilisateur bloqué sur un filtre devenu invisible.
  useEffect(() => {
    if (filterStatus === 'archived' && !loading && formationStats.archived === 0) {
      setFilterStatus('all');
    }
  }, [filterStatus, loading, formationStats.archived]);

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

  // Colonne « Prix » de la vue liste : le montant réel quand il existe, sinon le mode
  // d'accès — on n'invente aucun chiffre.
  const getPriceLabel = (formation) => {
    const mode = formation?.access_mode || formation?.meta?.access_mode || formation?.meta?.access?.mode || 'free';
    if (mode === 'one_time' && formation?.standalone_price != null) {
      return `${Number(formation.standalone_price).toLocaleString('fr-FR')} ${formation?.standalone_currency || 'XAF'}`;
    }
    return getAccessLabel(formation);
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

  // Menu d'actions PARTAGÉ entre la carte (grille) et la ligne (liste) : une seule
  // définition, sinon les deux vues divergent à la première évolution.
  const renderActionsMenu = (formation) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="Actions sur la formation"
          aria-label="Actions sur la formation"
          className="text-zinc-500 hover:text-[var(--lt-text)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]"
          disabled={structureLoading && structureLoadingId === formation.id}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-[var(--lt-card-bg)] border-[var(--lt-border)] text-zinc-700">
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
  );

  // Couverture générée (aplat chaud + initiales) partagée entre les deux vues.
  const renderGeneratedCover = (formation, sizeClass, textClass) => (
    <div
      aria-hidden="true"
      className={`${sizeClass} flex items-center justify-center shrink-0`}
      style={{ background: `linear-gradient(135deg, ${coverToneFor(formation.title)}, color-mix(in srgb, ${coverToneFor(formation.title)} 82%, black))` }}
    >
      <span className={`${textClass} font-serif font-bold text-[#f5f4ee]/90 select-none`}>
        {coverInitialsFor(formation.title)}
      </span>
    </div>
  );

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
              <span className="text-sm font-medium text-[var(--school-accent)]">Aperçu formation</span>
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
      <div className="h-[60vh] flex items-center justify-center text-zinc-500">
        Ouverture du constructeur…
      </div>
    );
  }

  return (
    <div className="relative min-h-[60vh]">
      {/* Ambient background (clair, très discret) */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[color-mix(in_srgb,var(--school-accent)_6%,transparent)] rounded-full blur-[100px]" />
        {/* Charte : halos uniquement dans la famille chaude (le violet est banni). */}
        <div className="absolute bottom-1/4 right-1/4 w-[250px] h-[250px] bg-[color-mix(in_srgb,var(--school-accent)_4%,transparent)] rounded-full blur-[80px]" />
      </div>

      <div className="space-y-6 relative">
      {/* Header Controls */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 p-5 rounded-[14px]"
        style={{ background: 'var(--lt-card-bg)', border: '1px solid var(--lt-card-border)', boxShadow: 'var(--lt-card-shadow)' }}
      >
        <div className="flex items-center gap-4 w-full xl:w-auto">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)]"
          >
            <Sparkles className="w-4 h-4" style={{ color: 'var(--lt-gold-ink)' }} />
            <span className="text-xs" style={{ color: 'var(--lt-gold-ink)' }}>Catalogue</span>
          </motion.div>
          <div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold tracking-tight" style={{ color: 'var(--lt-text)' }}>
              Mes Formations
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 w-full xl:w-auto flex-1 justify-end">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="relative w-full max-w-xs"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Rechercher une formation…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[var(--lt-card-bg)] border-[var(--lt-border)] text-[var(--lt-text)] placeholder:text-zinc-400"
            />
          </motion.div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-zinc-500" id="formations-filter-year-label">Année scolaire</span>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger
                aria-labelledby="formations-filter-year-label"
                className="w-[190px] bg-[var(--lt-card-bg)] border-[var(--lt-border)] text-[var(--lt-text)]"
              >
                <SelectValue placeholder="Toutes les années" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les années</SelectItem>
                <SelectItem value="1ère année">1ère année</SelectItem>
                <SelectItem value="2ème année">2ème année</SelectItem>
                <SelectItem value="3ème année">3ème année</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div
            className="flex items-center rounded-lg border border-[var(--lt-border)] bg-[var(--lt-card-bg)] p-0.5"
            role="group"
            aria-label="Affichage du catalogue"
          >
            <button
              type="button"
              title="Affichage en grille"
              aria-pressed={displayMode === 'grid'}
              onClick={() => setDisplayModePersist('grid')}
              className={`p-2 rounded-md transition-colors ${displayMode === 'grid' ? 'bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] text-[var(--school-accent)]' : 'text-zinc-500 hover:text-[var(--lt-text)] hover:bg-[color-mix(in_srgb,var(--school-accent)_8%,transparent)]'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Affichage en liste"
              aria-pressed={displayMode === 'list'}
              onClick={() => setDisplayModePersist('list')}
              className={`p-2 rounded-md transition-colors ${displayMode === 'list' ? 'bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] text-[var(--school-accent)]' : 'text-zinc-500 hover:text-[var(--lt-text)] hover:bg-[color-mix(in_srgb,var(--school-accent)_8%,transparent)]'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={() => navigate('/studio')}
              variant="outline"
              className="border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] whitespace-nowrap"
            >
              <Sparkles className="h-4 w-4 mr-2" /> Studio Créateur
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={() => { setSelectedFormation(null); setViewMode('create'); }}
              className="bg-[var(--school-accent)] text-black hover:bg-amber-500 font-bold whitespace-nowrap shadow-lg shadow-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]"
            >
              <Plus className="h-4 w-4 mr-2" /> Créer
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Les compteurs SONT les filtres de statut (comme les chips du Calendrier) :
          un clic filtre la liste, l'état actif est corail. « Archivées » n'apparaît
          que s'il y a quelque chose à filtrer — un zéro permanent n'est pas une info. */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer par statut">
        {[
          { key: 'all', label: 'Toutes', value: formationStats.total },
          { key: 'published', label: 'Publiées', value: formationStats.published },
          { key: 'draft', label: 'Brouillons', value: formationStats.draft },
          ...(formationStats.archived > 0 ? [{ key: 'archived', label: 'Archivées', value: formationStats.archived }] : []),
        ].map((item) => {
          const active = filterStatus === item.key;
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilterStatus(item.key)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full border text-sm transition-colors ${
                active
                  ? 'border-[color-mix(in_srgb,var(--school-accent)_55%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_16%,transparent)] text-[var(--school-accent)] font-semibold'
                  : 'border-[var(--lt-border)] bg-[var(--lt-card-bg)] text-zinc-500 hover:text-[var(--lt-text)] hover:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)]'
              }`}
            >
              <span>{item.label}</span>
              <span className={`tabular-nums text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-[color-mix(in_srgb,var(--school-accent)_22%,transparent)]' : 'bg-[color-mix(in_srgb,var(--lt-text)_8%,transparent)]'}`}>
                {item.value}
              </span>
            </button>
          );
        })}
      </div>

      {/* Contenu : grille de cartes OU liste compacte, mêmes données et mêmes actions. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={displayMode}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className={displayMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'flex flex-col gap-2'}
        >
          {loading && displayMode === 'list' ? (
            <>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-14 rounded-[12px] border border-[var(--lt-border)] bg-[var(--lt-card-bg)] animate-pulse" />
              ))}
              {slowLoad && (
                <p className="text-center text-amber-600 text-sm pt-2 pb-4">
                  Chargement toujours en cours (latence réseau ou serveur), merci de patienter…
                </p>
              )}
            </>
          ) : null}
          {loading && displayMode === 'grid' ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-[14px] overflow-hidden border border-[var(--lt-border)] bg-[var(--lt-card-bg)] animate-pulse"
                >
                  <div className="h-44 bg-black/[0.05]" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-black/[0.08] rounded w-3/4" />
                    <div className="h-3 bg-black/[0.05] rounded w-1/2" />
                  </div>
                </motion.div>
              ))}
              {slowLoad && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-full text-center text-amber-600 text-sm pt-2 pb-4"
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
              className="col-span-full flex flex-col items-center gap-4 py-14 text-center rounded-[14px] border border-red-200 bg-red-50"
            >
              <AlertTriangle className="w-12 h-12 text-red-500" />
              <div className="text-red-700 font-semibold text-sm max-w-sm">
                {String(error?.message || error) === 'formations_load_timeout'
                  ? 'Délai dépassé en attendant la base de données. Causes fréquentes : connexion instable, antivirus/VPN (HTTPS), ou configuration du build différente du projet visé. Regarde l\'onglet Réseau (F12) pour les requêtes en échec, puis réessaie.'
                  : String(error?.message || error)}
              </div>
              <Button
                variant="outline"
                className="bg-[var(--lt-card-bg)] border-[var(--lt-border)] text-zinc-700 hover:opacity-80"
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
              className="col-span-full text-center py-16 rounded-[14px] border border-dashed border-[var(--lt-border)] bg-[var(--lt-card-bg)]"
            >
              <BookOpen className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--lt-gold-ink)' }} />
              <p className="font-semibold" style={{ color: 'var(--lt-text)' }}>Aucune formation trouvée</p>
              <p className="text-sm text-zinc-500 mt-1">Ajuste les filtres ou crée une nouvelle formation.</p>
              <Button
                className="mt-4 bg-[var(--school-accent)] text-black hover:bg-amber-500 font-semibold"
                onClick={() => { setSelectedFormation(null); setViewMode('create'); }}
              >
                <Plus className="w-4 h-4 mr-2" /> Créer une formation
              </Button>
            </motion.div>
          ) : null}
          {!loading && !error && displayMode === 'list' && filteredFormations.length > 0 ? (
            <div className="hidden sm:flex items-center gap-3 px-3 pb-1 text-[11px] uppercase tracking-wide text-zinc-500" aria-hidden="true">
              <span className="w-12 shrink-0" />
              <span className="flex-1">Formation</span>
              <span className="w-20 text-left">Statut</span>
              <span className="w-24 text-right hidden md:block">Prix</span>
              <span className="w-28 text-right">Mise à jour</span>
              <span className="w-10 shrink-0" />
            </div>
          ) : null}
          {!loading &&
            filteredFormations.map((formation, index) => {
              const updatedLabel = formatDateFr(formation.updated_at || formation.created_at);
              const isOpening = structureLoading && structureLoadingId === formation.id;
              const statusBadge = (
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
              );

              if (displayMode === 'list') {
                return (
                  <motion.div
                    key={formation.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(index * 0.02, 0.4) }}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => openDetails(formation)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openDetails(formation);
                        }
                      }}
                      title={isOpening ? 'Ouverture…' : `Ouvrir « ${formation.title} »`}
                      className="flex items-center gap-3 px-3 py-2 rounded-[12px] border border-[var(--lt-border)] bg-[var(--lt-card-bg)] hover:border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_5%,var(--lt-card-bg))] cursor-pointer transition-colors"
                    >
                      {formation.thumbnail ? (
                        <img src={formation.thumbnail} alt="" className="w-12 h-9 rounded-md object-cover shrink-0" />
                      ) : (
                        renderGeneratedCover(formation, 'w-12 h-9 rounded-md', 'text-xs')
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--lt-text)' }} title={formation.title}>
                          {formation.title}
                        </p>
                        {formation.year ? <p className="text-[11px] text-zinc-500">{formation.year}</p> : null}
                      </div>
                      <span className="w-20 shrink-0 hidden sm:block">{statusBadge}</span>
                      <span className="w-24 shrink-0 text-right text-xs text-zinc-500 hidden md:block">{getPriceLabel(formation)}</span>
                      <span className="w-28 shrink-0 text-right text-xs text-zinc-500 tabular-nums hidden sm:block">
                        {updatedLabel || '—'}
                      </span>
                      <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        {renderActionsMenu(formation)}
                      </span>
                    </div>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={formation.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.6) }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card
                    className="rounded-[14px] overflow-hidden border border-[var(--lt-border)] bg-[var(--lt-card-bg)] hover:border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] transition-all group cursor-pointer"
                    style={{ boxShadow: 'var(--lt-card-shadow)' }}
                    onClick={() => openDetails(formation)}
                    title={isOpening ? 'Ouverture…' : `Ouvrir « ${formation.title} »`}
                  >
                    <div className="h-44 relative overflow-hidden">
                      {formation.thumbnail ? (
                        <>
                          <motion.img
                            src={formation.thumbnail}
                            alt={formation.title}
                            className="w-full h-full object-cover"
                            whileHover={{ scale: 1.08 }}
                            transition={{ duration: 0.5 }}
                          />
                          {/* Voile de lisibilité UNIQUEMENT sur photo : sur l'aplat généré il grise pour rien. */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent pointer-events-none" />
                        </>
                      ) : (
                        renderGeneratedCover(formation, 'w-full h-full', 'text-4xl')
                      )}
                      <div className="absolute top-3 right-3 flex gap-2">
                        {formation.year ? (
                          <Badge className="bg-black/50 text-white backdrop-blur-xl border border-white/10">
                            {formation.year}
                          </Badge>
                        ) : null}
                        <Badge className="bg-black/55 text-[#f5f4ee] backdrop-blur-xl border border-white/10">
                          {getAccessLabel(formation)}
                        </Badge>
                      </div>
                      <div className="absolute bottom-3 left-3">{statusBadge}</div>
                    </div>

                    <CardContent className="p-4">
                      <h3 className="text-base font-bold line-clamp-2 min-h-[2.6em] transition-colors group-hover:text-[var(--lt-gold-ink)]" style={{ color: 'var(--lt-text)' }} title={formation.title}>
                        {formation.title}
                      </h3>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        {/* « Màj » abrégé : la version longue tronquait la date, qui est
                            justement l'info qui distingue deux brouillons homonymes. */}
                        <span className="text-xs text-zinc-500 tabular-nums truncate" title={updatedLabel ? `Dernière mise à jour : ${updatedLabel}` : undefined}>
                          {updatedLabel ? `Màj ${updatedLabel}` : ''}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            title="Ouvrir la structure (modules et leçons)"
                            onClick={(e) => { e.stopPropagation(); openDetails(formation); }}
                            disabled={isOpening}
                            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 px-2 py-1.5 rounded-md hover:text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] transition-colors disabled:opacity-60"
                          >
                            <Layers className="w-4 h-4" /> {isOpening ? 'Ouverture…' : 'Structure'}
                          </button>
                          {renderActionsMenu(formation)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
        </motion.div>
      </AnimatePresence>
      </div>

      {/* Delete Confirmation */}
      <Dialog open={alertConfig.open} onOpenChange={(val) => !val && setAlertConfig({ ...alertConfig, open: false })}>
        <DialogContent className="bg-[var(--lt-card-bg)] border border-[var(--lt-border)] text-[var(--lt-text)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="h-5 w-5"/> Suppression irréversible</DialogTitle>
            <DialogDescription className="text-zinc-500 pt-2">
              Êtes-vous sûr de vouloir supprimer la formation <strong>"{alertConfig.data?.title}"</strong> ? <br/>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setAlertConfig({ open: false })} className="text-zinc-600 hover:opacity-80">Annuler</Button>
            <Button variant="destructive" onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Supprimer définitivement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default OwnerFormationsTab;