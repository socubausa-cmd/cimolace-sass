import React, { useState } from 'react';
import SEO from '@/components/SEO';
import { Link } from 'react-router-dom';
import {
  BookOpen, Search, Filter, Grid3X3, List,
  ArrowRight, GraduationCap, FileText, Tag,
  BookMarked, Library, ScrollText,
} from 'lucide-react';
import { getActiveTenantBranding } from '@/lib/tenant/activeBranding';

const libraryPageTitle = () => `Bibliothèque ${getActiveTenantBranding().name}`;

/**
 * Catalogue de la bibliothèque ISNA — ouvrages du programme fondamental.
 * Les contenus (chapitres) sont en cours de rédaction par l'institut : les ouvrages
 * sont présentés en « à venir » (comingSoon) tant que le contenu n'est pas publié.
 */
const books = [
  {
    id: 'fondements-tajwid',
    title: 'Les Fondements du Tajwîd',
    subtitle: 'Niveau 1',
    description: "Les règles essentielles de la récitation : points d'articulation (makharij), Noûn Sâkinah et Tanwîn, les Madd et les attributs des lettres.",
    category: 'Tajwîd',
    serie: 'Programme fondamental',
    chapters: 8,
    color: 'gold',
    icon: BookOpen,
    tags: ['Makharij', 'Noûn Sâkinah', 'Madd', 'Sifât'],
    status: 'En préparation',
    comingSoon: true,
    order: 1,
  },
  {
    id: 'sciences-coran',
    title: 'Introduction aux Sciences du Coran',
    subtitle: 'Niveau 1',
    description: "ʿUlûm al-Qurʾân : la révélation, les causes de descente (asbâb an-nuzûl), la compilation et les premières clés de compréhension du texte.",
    category: 'Sciences du Coran',
    serie: 'Programme fondamental',
    chapters: 6,
    color: 'gold',
    icon: ScrollText,
    tags: ['Asbâb an-nuzûl', 'Révélation', 'Compilation', 'Tafsîr'],
    status: 'En préparation',
    comingSoon: true,
    order: 2,
  },
  {
    id: 'fiqh-adorations',
    title: 'Fiqh des Adorations',
    subtitle: 'Niveau 1',
    description: "Purification, prière, jeûne et zakât : les piliers pratiques de l'adoration expliqués pas à pas, avec leurs conditions et obligations.",
    category: 'Fiqh',
    serie: 'Programme fondamental',
    chapters: 7,
    color: 'gold',
    icon: BookMarked,
    tags: ['Tahâra', 'Salât', 'Sawm', 'Zakât'],
    status: 'En préparation',
    comingSoon: true,
    order: 3,
  },
  {
    id: 'grammaire-arabe',
    title: 'Grammaire Arabe Fondamentale',
    subtitle: 'Niveau 1',
    description: "Les bases de la langue : phrase nominale et verbale, la déclinaison (iʿrâb), la conjugaison et les premières lectures guidées.",
    category: 'Langue arabe',
    serie: 'Programme fondamental',
    chapters: 9,
    color: 'gold',
    icon: GraduationCap,
    tags: ['Nahw', 'Sarf', 'Jumla', 'Iʿrâb'],
    status: 'En préparation',
    comingSoon: true,
    order: 4,
  },
];

const categories = ['Tous', ...new Set(books.map((b) => b.category))];
const series = ['Toutes', ...new Set(books.map((b) => b.serie))];

// Décor NEUTRE (règle design produit « impeccable » : l'accent coral est réservé aux
// ACTIONS / sélection / état — jamais la décoration, jamais en aplat plein sur des cartes
// ni sur des états inactifs). Les cartes = couches neutres ; le coral n'apparaît que sur
// le CTA d'un ouvrage disponible + le filtre actif. Cf. product.md (Restrained).
const colorMap = {
  gold: {
    bg: 'bg-white/[0.03]', border: 'border-white/10', hoverBorder: 'hover:border-white/20',
    text: 'text-gray-400', badge: 'bg-white/5 text-gray-400 border-white/10',
  },
};

const BookCard = ({ book, viewMode, embedded = false }) => {
  const c = colorMap[book.color] || colorMap.gold;
  const Icon = book.icon;
  const soon = book.comingSoon;
  const to = embedded ? `/student-school-life/bibliotheque/${book.id}` : `/bibliotheque/${book.id}`;
  const Wrapper = soon ? 'div' : Link;
  const wp = soon ? {} : { to };

  if (viewMode === 'list') {
    return (
      <Wrapper {...wp} className="block group">
        <div className={`bg-[#2e2b28] ${c.border} border rounded-xl p-4 transition-all ${soon ? '' : `${c.hoverBorder} hover:bg-[#33302c]`}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${c.bg} ${c.border} border flex items-center justify-center shrink-0`}>
              <Icon className={`w-6 h-6 ${c.text}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`text-base font-bold text-white transition-colors ${soon ? '' : 'group-hover:text-[var(--school-accent)]'}`}>{book.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${c.badge}`}>{book.subtitle}</span>
              </div>
              <p className="text-sm text-gray-400 mt-0.5 truncate">{book.description}</p>
            </div>
            <div className="hidden md:flex items-center gap-3 shrink-0">
              <span className="text-xs text-gray-500">{book.chapters} chapitres</span>
              <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/5">{book.category}</span>
              {soon
                ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-300 border border-white/10 font-bold">Bientôt</span>
                : <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-[var(--school-accent)] transition-colors" />}
            </div>
          </div>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper {...wp} className="block group h-full">
      <div className={`bg-[#2e2b28] ${c.border} border rounded-2xl overflow-hidden transition-all h-full flex flex-col ${soon ? '' : `${c.hoverBorder} hover:bg-[#33302c] hover:-translate-y-1`}`}>
        {/* Vignette = image réelle (book.coverUrl) si fournie, sinon COUVERTURE GÉNÉRÉE :
            planche de livre éditoriale sobre (cadre fin + emblème catégorie + titre serif
            + filet). Palette neutre — aucun aplat de couleur (cf. règle « accent = action »). */}
        <div className="relative h-44 shrink-0 overflow-hidden" style={{ background: '#282521' }}>
          {book.coverUrl ? (
            <img src={book.coverUrl} alt={`Couverture — ${book.title}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <>
              <div className="absolute inset-3 rounded-md border border-white/[0.09]" />
              <div className="absolute inset-[13px] rounded border border-white/[0.05]" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                <Icon className="h-7 w-7 text-white/30" strokeWidth={1.25} />
                <span className="text-[8.5px] font-bold uppercase tracking-[0.22em] text-gray-500">{book.serie}</span>
                <h3 className={`font-serif text-lg md:text-xl font-bold leading-snug text-white ${soon ? '' : 'transition-colors group-hover:text-[var(--school-accent)]'}`}>{book.title}</h3>
                <span className="mt-0.5 h-px w-8 bg-white/15" />
              </div>
            </>
          )}
          <div className="absolute top-3 right-3">
            <span className={`text-[10px] px-2 py-1 rounded-full border ${c.badge} font-bold`}>{book.subtitle}</span>
          </div>
          {soon && (
            <div className="absolute top-3 left-3">
              <span className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-gray-300 border border-white/10 font-bold">Bientôt</span>
            </div>
          )}
        </div>
        <div className="p-5 flex-1 flex flex-col">
          <p className="text-sm text-gray-400 leading-relaxed flex-1">{book.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {book.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-500 border border-white/5">{tag}</span>
            ))}
            {book.tags.length > 3 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-500 border border-white/5">+{book.tags.length - 3}</span>}
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 flex items-center gap-1"><FileText className="w-3 h-3" /> {book.chapters} ch.</span>
              <span className="text-xs text-gray-500 flex items-center gap-1"><Tag className="w-3 h-3" /> {book.category}</span>
            </div>
            <span className={`text-xs font-bold ${soon ? c.text : 'text-[var(--school-accent)]'} flex items-center gap-1 transition-all ${soon ? '' : 'group-hover:gap-2'}`}>
              {soon ? 'Bientôt' : <>Lire <ArrowRight className="w-3 h-3" /></>}
            </span>
          </div>
        </div>
      </div>
    </Wrapper>
  );
};

const BibliothequePage = ({ embedded = false }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [selectedSerie, setSelectedSerie] = useState('Toutes');
  const [viewMode, setViewMode] = useState('grid');

  const filtered = books.filter((book) => {
    const matchSearch = searchQuery === '' ||
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchCat = selectedCategory === 'Tous' || book.category === selectedCategory;
    const matchSerie = selectedSerie === 'Toutes' || book.serie === selectedSerie;
    return matchSearch && matchCat && matchSerie;
  }).sort((a, b) => a.order - b.order);

  const resetFilters = () => { setSelectedCategory('Tous'); setSelectedSerie('Toutes'); setSearchQuery(''); };

  const Filters = () => (
    <div className="bg-[#2e2b28]/80 border border-white/5 rounded-2xl p-4 space-y-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Rechercher un ouvrage, un thème…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] transition-all"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500"><Filter className="w-3.5 h-3.5" /> Filtres :</div>
        <div className="flex gap-1.5 flex-wrap">
          {categories.map((cat) => (
            <button key={cat} onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedCategory === cat ? 'bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]' : 'bg-white/5 text-gray-400 border border-white/5 hover:text-white hover:bg-white/10'
              }`}>{cat}</button>
          ))}
        </div>
        <div className="w-px h-5 bg-white/10 hidden sm:block" />
        <div className="flex gap-1.5 flex-wrap">
          {series.map((s) => (
            <button key={s} onClick={() => setSelectedSerie(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedSerie === s ? 'bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]' : 'bg-white/5 text-gray-400 border border-white/5 hover:text-white hover:bg-white/10'
              }`}>{s}</button>
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}><Grid3X3 className="w-4 h-4" /></button>
          <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}><List className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );

  const Results = () => (
    <>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500">{filtered.length} ouvrage{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}</p>
        {(selectedCategory !== 'Tous' || selectedSerie !== 'Toutes' || searchQuery) && (
          <button onClick={resetFilters} className="text-xs text-[var(--school-accent)] hover:text-yellow-400 transition-colors">Réinitialiser les filtres</button>
        )}
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-20"><BookOpen className="w-12 h-12 text-gray-700 mx-auto mb-4" /><p className="text-gray-500 text-lg">Aucun ouvrage ne correspond.</p></div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{filtered.map((book) => <BookCard key={book.id} book={book} viewMode="grid" embedded={embedded} />)}</div>
      ) : (
        <div className="space-y-3">{filtered.map((book) => <BookCard key={book.id} book={book} viewMode="list" embedded={embedded} />)}</div>
      )}
      <section className="mt-12 bg-[#2e2b28] border border-white/5 rounded-2xl p-6">
        <h2 className="text-xl font-serif font-bold text-white mb-6 flex items-center gap-2"><BookMarked className="w-5 h-5 text-[var(--school-accent)]" /> Ordre de lecture recommandé</h2>
        <div className="space-y-3">
          {[...books].sort((a, b) => a.order - b.order).map((book, i) => {
            const c = colorMap[book.color] || colorMap.gold;
            const Icon = book.icon;
            return (
              <div key={book.id} className="flex items-center gap-4 p-3 rounded-xl">
                <div className={`w-9 h-9 rounded-lg ${c.bg} ${c.border} border flex items-center justify-center shrink-0`}><span className={`text-sm font-bold ${c.text}`}>{i + 1}</span></div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white">{book.title}</h3>
                  <p className="text-xs text-gray-500 truncate">{book.subtitle} — {book.chapters} chapitres</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-300 border border-white/10 font-bold">Bientôt</span>
                <Icon className={`w-4 h-4 ${c.text} opacity-50`} />
              </div>
            );
          })}
        </div>
      </section>
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-6 pb-8">
        <SEO title={libraryPageTitle()} />
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]">
            <Library className="w-6 h-6 text-[var(--school-accent)]" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-white">{libraryPageTitle()}</h1>
            <p className="text-gray-400 text-sm">{books.length} ouvrages — {books.reduce((s, b) => s + b.chapters, 0)} chapitres · programme fondamental</p>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-0 mb-8"><Filters /></div>
        <div className="max-w-5xl mx-auto px-0 pb-8"><Results /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#18130f] text-white">
      <SEO
        title={libraryPageTitle()}
        description={`Bibliothèque ${getActiveTenantBranding().name} : ouvrages du programme fondamental — Tajwîd, Sciences du Coran, Fiqh et Langue arabe.`}
      />
      <section className="relative py-24 md:py-32 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#18130f] via-[#2b2219]/40 to-[#18130f]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full blur-[250px]" />
        <div className="relative max-w-4xl mx-auto text-center space-y-5">
          <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[var(--school-accent)] text-xs font-bold uppercase tracking-widest border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]">
            <Library className="w-4 h-4" /> {libraryPageTitle()}
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-white leading-tight">
            Les ouvrages du<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--school-accent)] via-yellow-400 to-[var(--school-accent)]">programme</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            {`Tajwîd, Sciences du Coran, Fiqh et Langue arabe — la bibliothèque ${getActiveTenantBranding().name}.`}
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
            <span className="flex items-center gap-1.5"><BookOpen className="w-4 h-4 text-[var(--school-accent)]" /> <strong className="text-white">{books.length}</strong> ouvrages</span>
            <span className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-[var(--school-accent)]" /> <strong className="text-white">{books.reduce((s, b) => s + b.chapters, 0)}</strong> chapitres</span>
          </div>
        </div>
      </section>
      <div className="max-w-5xl mx-auto px-4 md:px-6 mb-8"><Filters /></div>
      <div className="max-w-5xl mx-auto px-4 md:px-6 pb-20">
        <Results />
        <div className="text-center py-8 mt-8 border-t border-white/5">
          <p className="text-sm text-gray-600">{`© ${getActiveTenantBranding().name} — Tous droits réservés`}</p>
        </div>
      </div>
    </div>
  );
};

export default BibliothequePage;
