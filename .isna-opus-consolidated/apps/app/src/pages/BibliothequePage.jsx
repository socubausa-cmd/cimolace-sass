import React, { useState } from 'react';
import SEO from '@/components/SEO';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  BookOpen, Search, Filter, Grid3X3, List, Star,
  ChevronDown, ArrowRight, Atom, Zap, Globe, Layers,
  GraduationCap, Crown, Eye, Clock, FileText, Tag,
  BookMarked, Library, Sparkles, ScrollText
} from 'lucide-react';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const LIBRARY_PAGE_TITLE = `Bibliothèque ${isnaTenantConfig.branding.name}`;

const books = [
  {
    id: 'fond-de-tout',
    title: 'Le Fond de Tout',
    subtitle: 'Livre I',
    description: 'Ontologie, Potentia Prima, champ de permission et les 10 équations fondamentales. La question que personne ne pose correctement.',
    path: '/fond-de-tout',
    category: 'Ontologie',
    serie: 'Corpus',
    chapters: 7,
    color: 'yellow',
    icon: Layers,
    tags: ['Potentia Prima', 'Champ Φ', 'Qualia', 'Équations', 'Vibratinium'],
    status: 'Publié',
    order: 1,
  },
  {
    id: 'dialogue-physique',
    title: 'Le Dialogue avec la Physique',
    subtitle: 'Livre II — Version Dialectique',
    description: 'Big Bang, vide quantique, énergie sombre, conscience et les 5 prédictions testables. Dialogue entre ce corpus et la physique standard.',
    path: '/dialogue-physique',
    category: 'Physique',
    serie: 'Corpus',
    chapters: 9,
    color: 'blue',
    icon: Atom,
    tags: ['Big Bang', 'Vide quantique', 'Pauli', 'Énergie sombre', 'Conscience'],
    status: 'Publié',
    order: 2,
  },
  {
    id: 'ontodynamique',
    title: 'Ontodynamique',
    subtitle: "Partie V — L'Histoire Complète du Cosmos",
    description: 'Mécanique Différentielle et Géométrie des Cordes Énergétiques. Espace-Temps-Énergie, les 4 régimes de cordes et la sélection progressive.',
    path: '/ontodynamique',
    category: 'Cosmologie',
    serie: 'Histoire du Cosmos',
    chapters: 6,
    color: 'emerald',
    icon: Zap,
    tags: ['Cordes', 'E-T-Énergie', 'Particules', 'Différentiel Δ', 'Sélection'],
    status: 'Publié',
    order: 3,
  },
  {
    id: 'manuel-initiatique-bris-de-sort',
    title: 'Manuel Initiatique',
    subtitle: 'Rituel de Bris de Sort',
    description: "Transmission du 5ᵉ Manikongo — Ngowazulu. Doctrine (Mpandu, Nzinga, Nsanku, Croix d'Incarnation) et protocoles pratiques.",
    path: '/manuel-initiatique-bris-de-sort',
    category: 'Rituel',
    serie: 'Corpus',
    chapters: 8,
    color: 'violet',
    icon: ScrollText,
    tags: ['Mpandu', 'Nzinga', 'Nsanku', "Croix d'Incarnation", 'ELAPSI TIYAH'],
    status: 'Publié',
    order: 4,
  },
];

const categories = ['Tous', ...new Set(books.map(b => b.category))];
const series = ['Toutes', ...new Set(books.map(b => b.serie))];

const colorMap = {
  yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', hoverBorder: 'hover:border-yellow-500/40', text: 'text-yellow-400', badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', hoverBorder: 'hover:border-blue-500/40', text: 'text-blue-400', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', hoverBorder: 'hover:border-emerald-500/40', text: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/20', hoverBorder: 'hover:border-violet-500/40', text: 'text-violet-400', badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', hoverBorder: 'hover:border-rose-500/40', text: 'text-rose-400', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', hoverBorder: 'hover:border-cyan-500/40', text: 'text-cyan-400', badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', hoverBorder: 'hover:border-orange-500/40', text: 'text-orange-400', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
};

const BookCard = ({ book, viewMode }) => {
  const c = colorMap[book.color] || colorMap.yellow;
  const Icon = book.icon;

  if (viewMode === 'list') {
    return (
      <Link to={book.path} className="block group">
        <div className={`bg-[#192734] ${c.border} border rounded-xl p-4 ${c.hoverBorder} transition-all hover:bg-[#1d2f40]`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${c.bg} ${c.border} border flex items-center justify-center shrink-0`}>
              <Icon className={`w-6 h-6 ${c.text}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white group-hover:text-[#D4AF37] transition-colors">{book.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${c.badge}`}>{book.subtitle}</span>
              </div>
              <p className="text-sm text-gray-400 mt-0.5 truncate">{book.description}</p>
            </div>
            <div className="hidden md:flex items-center gap-3 shrink-0">
              <span className="text-xs text-gray-500">{book.chapters} chapitres</span>
              <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/5">{book.category}</span>
              <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-[#D4AF37] transition-colors" />
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={book.path} className="block group">
      <div className={`bg-[#192734] ${c.border} border rounded-2xl overflow-hidden ${c.hoverBorder} transition-all hover:bg-[#1d2f40] hover:-translate-y-1 h-full flex flex-col`}>
        {/* Cover */}
        <div className={`relative h-44 ${c.bg} flex items-center justify-center overflow-hidden`}>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#192734]/80" />
          <Icon className={`w-16 h-16 ${c.text} opacity-30 absolute`} />
          <div className="relative text-center px-4">
            <span className={`text-xs font-bold ${c.text} uppercase tracking-widest`}>{book.serie}</span>
            <h3 className="text-xl md:text-2xl font-serif font-bold text-white mt-1 group-hover:text-[#D4AF37] transition-colors">{book.title}</h3>
          </div>
          <div className="absolute top-3 right-3">
            <span className={`text-[10px] px-2 py-1 rounded-full border ${c.badge} font-bold`}>{book.subtitle}</span>
          </div>
        </div>
        {/* Body */}
        <div className="p-5 flex-1 flex flex-col">
          <p className="text-sm text-gray-400 leading-relaxed flex-1">{book.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {book.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-500 border border-white/5">{tag}</span>
            ))}
            {book.tags.length > 3 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-500 border border-white/5">+{book.tags.length - 3}</span>}
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 flex items-center gap-1"><FileText className="w-3 h-3" /> {book.chapters} ch.</span>
              <span className="text-xs text-gray-500 flex items-center gap-1"><Tag className="w-3 h-3" /> {book.category}</span>
            </div>
            <span className={`text-xs font-bold ${c.text} flex items-center gap-1 group-hover:gap-2 transition-all`}>
              Lire <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

const BibliothequePage = ({ embedded = false }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [selectedSerie, setSelectedSerie] = useState('Toutes');
  const [viewMode, setViewMode] = useState('grid');

  const filtered = books.filter(book => {
    const matchSearch = searchQuery === '' ||
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchCat = selectedCategory === 'Tous' || book.category === selectedCategory;
    const matchSerie = selectedSerie === 'Toutes' || book.serie === selectedSerie;
    return matchSearch && matchCat && matchSerie;
  }).sort((a, b) => a.order - b.order);

  const FiltersAndContent = () => (
    <>
      {/* FILTERS */}
      <div className="max-w-5xl mx-auto px-0 mb-8">
        <div className="bg-[#192734]/80 border border-white/5 rounded-2xl p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Rechercher un livre, un concept, un tag..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#D4AF37]/30 focus:ring-1 focus:ring-[#D4AF37]/20 transition-all"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500"><Filter className="w-3.5 h-3.5" /> Filtres :</div>
            <div className="flex gap-1.5 flex-wrap">
              {categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedCategory === cat ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30' : 'bg-white/5 text-gray-400 border border-white/5 hover:text-white hover:bg-white/10'
                  }`}>{cat}</button>
              ))}
            </div>
            <div className="w-px h-5 bg-white/10 hidden sm:block" />
            <div className="flex gap-1.5 flex-wrap">
              {series.map(s => (
                <button key={s} onClick={() => setSelectedSerie(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedSerie === s ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'bg-white/5 text-gray-400 border border-white/5 hover:text-white hover:bg-white/10'
                  }`}>{s}</button>
              ))}
            </div>
            <div className="ml-auto flex gap-1">
              <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}><Grid3X3 className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}><List className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </div>
      {/* RESULTS */}
      <div className="max-w-5xl mx-auto px-0 pb-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">{filtered.length} ouvrage{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}</p>
          {(selectedCategory !== 'Tous' || selectedSerie !== 'Toutes' || searchQuery) && (
            <button onClick={() => { setSelectedCategory('Tous'); setSelectedSerie('Toutes'); setSearchQuery(''); }} className="text-xs text-[#D4AF37] hover:text-yellow-400 transition-colors">Réinitialiser les filtres</button>
          )}
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-20"><BookOpen className="w-12 h-12 text-gray-700 mx-auto mb-4" /><p className="text-gray-500 text-lg">Aucun ouvrage ne correspond.</p></div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{filtered.map(book => <BookCard key={book.id} book={book} viewMode="grid" />)}</div>
        ) : (
          <div className="space-y-3">{filtered.map(book => <BookCard key={book.id} book={book} viewMode="list" />)}</div>
        )}
        <section className="mt-12 bg-[#192734] border border-white/5 rounded-2xl p-6">
          <h2 className="text-xl font-serif font-bold text-white mb-6 flex items-center gap-2"><BookMarked className="w-5 h-5 text-[#D4AF37]" /> Ordre de lecture recommandé</h2>
          <div className="space-y-3">
            {books.sort((a, b) => a.order - b.order).map((book, i) => {
              const c = colorMap[book.color] || colorMap.yellow;
              const Icon = book.icon;
              return (
                <Link to={book.path} key={book.id} className="group block">
                  <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/[0.03] transition-all">
                    <div className={`w-9 h-9 rounded-lg ${c.bg} ${c.border} border flex items-center justify-center shrink-0`}><span className={`text-sm font-bold ${c.text}`}>{i + 1}</span></div>
                    <div className="flex-1 min-w-0"><h3 className="text-sm font-bold text-white group-hover:text-[#D4AF37] transition-colors">{book.title}</h3><p className="text-xs text-gray-500 truncate">{book.subtitle} — {book.chapters} chapitres</p></div>
                    <Icon className={`w-4 h-4 ${c.text} opacity-50`} />
                    <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-[#D4AF37] transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-6 pb-8">
        <SEO title={LIBRARY_PAGE_TITLE} />
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#D4AF37]/10 rounded-xl border border-[#D4AF37]/20">
            <Library className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-white">{LIBRARY_PAGE_TITLE}</h1>
            <p className="text-gray-400 text-sm">{books.length} ouvrages — {books.reduce((s, b) => s + b.chapters, 0)} chapitres</p>
          </div>
        </div>
        <FiltersAndContent />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1419] text-white">
      <SEO
        title={LIBRARY_PAGE_TITLE}
        description={`Ouvrages fondateurs du corpus ${isnaTenantConfig.branding.name} : Le Fond de Tout, Le Dialogue avec la Physique, Ontodynamique. Filtrez et lisez en ligne.`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: LIBRARY_PAGE_TITLE,
          description: `Collection des ouvrages fondateurs — ${isnaTenantConfig.branding.name}.`,
          url: `${isnaTenantConfig.branding.publicSiteOrigin}/bibliotheque`,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: books.length,
            itemListElement: books.map((b, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              item: {
                '@type': 'Book',
                name: b.title,
                url: `${isnaTenantConfig.branding.publicSiteOrigin}${b.path}`,
              },
            })),
          },
        }}
      />

      {/* HERO */}
      <section className="relative py-24 md:py-32 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F1419] via-[#192734]/40 to-[#0F1419]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#D4AF37]/5 rounded-full blur-[250px]" />
        <div className="relative max-w-4xl mx-auto text-center space-y-5">
          <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] text-xs font-bold uppercase tracking-widest border border-[#D4AF37]/20">
            <Library className="w-4 h-4" /> {LIBRARY_PAGE_TITLE}
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-white leading-tight">
            Les Livres du<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-yellow-400 to-[#D4AF37]">Système</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            {`Explorez les ouvrages fondateurs — ${isnaTenantConfig.branding.name} — du Potentia Prima aux Cordes Énergétiques.`}
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
            <span className="flex items-center gap-1.5"><BookOpen className="w-4 h-4 text-[#D4AF37]" /> <strong className="text-white">{books.length}</strong> ouvrages</span>
            <span className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-[#D4AF37]" /> <strong className="text-white">{books.reduce((s, b) => s + b.chapters, 0)}</strong> chapitres</span>
            <span className="flex items-center gap-1.5"><Crown className="w-4 h-4 text-[#D4AF37]" /> 5ᵉ Manikongo</span>
          </div>
        </div>
      </section>

      {/* FILTERS */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 mb-8">
        <div className="bg-[#192734]/80 border border-white/5 rounded-2xl p-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Rechercher un livre, un concept, un tag..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#D4AF37]/30 focus:ring-1 focus:ring-[#D4AF37]/20 transition-all"
            />
          </div>
          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Filter className="w-3.5 h-3.5" /> Filtres :
            </div>
            {/* Category */}
            <div className="flex gap-1.5 flex-wrap">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedCategory === cat
                      ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30'
                      : 'bg-white/5 text-gray-400 border border-white/5 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-white/10 hidden sm:block" />
            {/* Serie */}
            <div className="flex gap-1.5 flex-wrap">
              {series.map(s => (
                <button
                  key={s}
                  onClick={() => setSelectedSerie(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedSerie === s
                      ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                      : 'bg-white/5 text-gray-400 border border-white/5 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            {/* View toggle */}
            <div className="ml-auto flex gap-1">
              <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RESULTS */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 pb-20">
        {/* Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">
            {filtered.length} ouvrage{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}
          </p>
          {(selectedCategory !== 'Tous' || selectedSerie !== 'Toutes' || searchQuery) && (
            <button
              onClick={() => { setSelectedCategory('Tous'); setSelectedSerie('Toutes'); setSearchQuery(''); }}
              className="text-xs text-[#D4AF37] hover:text-yellow-400 transition-colors"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Aucun ouvrage ne correspond à votre recherche.</p>
            <button
              onClick={() => { setSelectedCategory('Tous'); setSelectedSerie('Toutes'); setSearchQuery(''); }}
              className="mt-4 text-sm text-[#D4AF37] hover:text-yellow-400"
            >
              Voir tous les ouvrages
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(book => <BookCard key={book.id} book={book} viewMode="grid" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(book => <BookCard key={book.id} book={book} viewMode="list" />)}
          </div>
        )}

        {/* READING ORDER */}
        <section className="mt-16 bg-[#192734] border border-white/5 rounded-2xl p-6 md:p-8">
          <h2 className="text-xl font-serif font-bold text-white mb-6 flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-[#D4AF37]" /> Ordre de lecture recommandé
          </h2>
          <div className="space-y-3">
            {books.sort((a, b) => a.order - b.order).map((book, i) => {
              const c = colorMap[book.color] || colorMap.yellow;
              const Icon = book.icon;
              return (
                <Link to={book.path} key={book.id} className="group block">
                  <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/[0.03] transition-all">
                    <div className={`w-9 h-9 rounded-lg ${c.bg} ${c.border} border flex items-center justify-center shrink-0`}>
                      <span className={`text-sm font-bold ${c.text}`}>{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-white group-hover:text-[#D4AF37] transition-colors">{book.title}</h3>
                      <p className="text-xs text-gray-500 truncate">{book.subtitle} — {book.chapters} chapitres</p>
                    </div>
                    <Icon className={`w-4 h-4 ${c.text} opacity-50`} />
                    <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-[#D4AF37] transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* FOOTER */}
        <div className="text-center py-8 mt-8 border-t border-white/5">
          <p className="text-sm text-gray-600">{`© ${isnaTenantConfig.branding.name} — NGOWAZULU — 5ᵉ Manikongo — Tous droits réservés`}</p>
        </div>
      </div>
    </div>
  );
};

export default BibliothequePage;
