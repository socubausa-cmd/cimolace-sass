import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  Search,
  BookOpen,
  Download,
  Bookmark,
  FileText,
  Video,
  Mic,
  Lock,
  ScrollText,
  ClipboardList,
  FolderOpen,
  Film,
  BookMarked,
  Filter,
  X,
  LayoutGrid
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ExpandableCard from '@/components/ui/ExpandableCard';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';
import { supabase } from '@/lib/customSupabaseClient';

/* ─── Thème ISNA (navy + or) — vue "Ressources" élève ─── */
const T = {
  surface:  '#12111a',
  surface2: 'rgba(25,39,52,0.5)',
  border:   'rgba(255,255,255,0.07)',
  gold:     '#D4AF37',
  goldDim:  'rgba(212,175,55,0.12)',
  goldMid:  'rgba(212,175,55,0.28)',
  t1: '#F5F5F7',
  t2: 'rgba(245,245,247,0.65)',
  t3: 'rgba(245,245,247,0.38)',
  t4: 'rgba(245,245,247,0.16)',
  mono: "'JetBrains Mono','Fira Code',monospace",
};

const CAT_ORDER = ['cours', 'documents', 'audio', 'glossaire', 'officiels', 'rapports'];
const CAT_META = {
  cours:     { label: 'Cours vidéo',         Icon: Film },
  documents: { label: 'Documents & guides',  Icon: FileText },
  audio:     { label: 'Audio & récitations', Icon: Mic },
  glossaire: { label: 'Glossaire',           Icon: BookMarked },
  officiels: { label: 'Documents officiels', Icon: FolderOpen },
  rapports:  { label: 'Synthèses de cours',  Icon: ClipboardList },
};
const TYPE_META = {
  video:   { label: 'Vidéo',   col: '#D4AF37', Icon: Video },
  pdf:     { label: 'PDF',     col: '#E0795F', Icon: FileText },
  audio:   { label: 'Audio',   col: '#8B9CFF', Icon: Mic },
  article: { label: 'Article', col: '#7FD1C0', Icon: BookOpen },
  link:    { label: 'Lien',    col: '#9AA4B2', Icon: BookOpen },
};

const ResCatPill = ({ active, label, count, Icon, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        background: active ? T.gold : hov ? T.surface2 : 'transparent',
        border: `1px solid ${active ? 'transparent' : hov ? T.goldMid : T.border}`,
        borderRadius: 999, padding: '7px 13px',
        fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
        color: active ? '#000' : hov ? T.gold : T.t2,
        cursor: 'pointer', transition: 'all 160ms ease', whiteSpace: 'nowrap',
      }}
    >
      <Icon size={13} color={active ? '#000' : hov ? T.gold : T.t3} />
      {label}
      {count != null && (
        <span style={{
          fontFamily: T.mono, fontSize: 10, fontWeight: 700,
          color: active ? '#000' : T.gold,
          background: active ? 'rgba(0,0,0,0.14)' : T.goldDim,
          borderRadius: 999, padding: '0 6px', minWidth: 16, textAlign: 'center',
        }}>{count}</span>
      )}
    </button>
  );
};

const ResCard = ({ r, delay }) => {
  const [hov, setHov] = useState(false);
  const tm = TYPE_META[r.resource_type] || TYPE_META.pdf;
  const meta = r.duration_label || r.size_label;
  const premium = r.access_level === 'academique_plus';
  const TypeIcon = tm.Icon;
  const open = () => { if (r.url && r.url !== '#') window.open(r.url, '_blank', 'noopener'); };
  return (
    <article
      onClick={open}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? 'rgba(25,39,52,0.65)' : 'rgba(25,39,52,0.36)',
        border: `1px solid ${hov ? T.goldMid : T.border}`,
        borderRadius: 14, padding: 16, cursor: 'pointer',
        transition: 'all 180ms ease', transform: hov ? 'translateY(-2px)' : 'none',
        animation: `resFade .4s ease ${delay}ms both`,
        display: 'flex', flexDirection: 'column', gap: 10, minHeight: 134,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'rgba(0,0,0,0.28)', border: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <TypeIcon size={18} color={tm.col} />
        </div>
        {premium ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: T.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em',
            color: T.gold, background: T.goldDim, border: `1px solid ${T.goldMid}`,
            borderRadius: 20, padding: '2px 8px',
          }}>
            <Lock size={10} /> Académique+
          </span>
        ) : (
          <Download size={15} color={hov ? T.t2 : T.t4} style={{ transition: 'color 180ms', marginTop: 4 }} />
        )}
      </div>
      <h4 style={{
        fontSize: 14, fontWeight: 600, color: hov ? T.gold : T.t1,
        lineHeight: 1.35, transition: 'color 180ms', margin: 0,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>{r.title}</h4>
      {r.description && (
        <p style={{
          fontSize: 12, color: T.t3, lineHeight: 1.5, margin: 0,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{r.description}</p>
      )}
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
        <span style={{
          fontFamily: T.mono, fontSize: 9.5, fontWeight: 700, color: tm.col,
          background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`,
          borderRadius: 6, padding: '2px 7px', letterSpacing: '0.05em', textTransform: 'uppercase',
        }}>{tm.label}</span>
        {meta && <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.t3 }}>{meta}</span>}
      </div>
    </article>
  );
};

const ResEmpty = ({ search }) => (
  <div style={{
    textAlign: 'center', padding: '48px 24px', color: T.t3, fontSize: 13,
    background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14,
  }}>
    {search ? `Aucune ressource pour « ${search} »` : 'Aucune ressource disponible pour le moment.'}
  </div>
);

const ResLoading = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} style={{
        height: 134, borderRadius: 14, background: 'rgba(25,39,52,0.36)',
        border: `1px solid ${T.border}`, animation: 'resPulse 1.4s ease-in-out infinite',
        animationDelay: `${i * 90}ms`,
      }} />
    ))}
  </div>
);

function EmbeddedResources() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('tous');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('resources')
        .select('id,title,description,category,resource_type,url,duration_label,size_label,access_level,order_index')
        .eq('is_published', true)
        .order('category', { ascending: true })
        .order('order_index', { ascending: true });
      if (!alive) return;
      setItems(Array.isArray(data) ? data : []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const counts = useMemo(() => {
    const m = { tous: items.length };
    items.forEach((r) => { m[r.category] = (m[r.category] || 0) + 1; });
    return m;
  }, [items]);

  const presentCats = CAT_ORDER.filter((c) => counts[c]);

  const q = search.trim().toLowerCase();
  const filtered = items.filter((r) =>
    (cat === 'tous' || r.category === cat) &&
    (!q || (r.title || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q))
  );

  return (
    <div style={{ paddingBottom: 32 }}>
      <Helmet><title>Ressources | ISNA</title></Helmet>
      <style>{`
        @keyframes resFade { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes resPulse { 0%,100% { opacity: .45 } 50% { opacity: .8 } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: T.goldDim, border: `1px solid ${T.goldMid}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <BookOpen size={22} color={T.gold} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: T.t1, letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0 }}>
              Ressources
            </h1>
            <p style={{ fontSize: 13, color: T.t3, marginTop: 3 }}>
              Cours, documents, audios et supports officiels de l&apos;institut.
            </p>
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20,
          padding: '5px 12px', fontFamily: T.mono, fontSize: 11, color: T.t2,
          flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          <span style={{ color: T.gold }}>◎</span>
          {items.length} ressources
        </div>
      </div>

      {/* Recherche */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, maxWidth: 420,
        background: T.surface, border: `1px solid ${focused ? T.goldMid : T.border}`,
        borderRadius: 11, padding: '9px 12px', transition: 'border-color 150ms ease',
      }}>
        <Search size={15} color={T.t3} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Rechercher une ressource…"
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: T.t1, fontSize: 13, fontFamily: 'inherit' }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.t3, display: 'flex', padding: 0 }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Catégories */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0 22px' }}>
        <ResCatPill active={cat === 'tous'} label="Tous" count={counts.tous} Icon={LayoutGrid} onClick={() => setCat('tous')} />
        {presentCats.map((c) => (
          <ResCatPill key={c} active={cat === c} label={CAT_META[c]?.label || c} count={counts[c]} Icon={CAT_META[c]?.Icon || FileText} onClick={() => setCat(c)} />
        ))}
      </div>

      {/* Grille */}
      {loading ? (
        <ResLoading />
      ) : filtered.length === 0 ? (
        <ResEmpty search={q} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filtered.map((r, i) => <ResCard key={r.id} r={r} delay={i * 40} />)}
        </div>
      )}
    </div>
  );
}

const LibraryPage = ({ embedded = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeEmbeddedCategory, setActiveEmbeddedCategory] = useState('videos');

  const categories = [
    {
      id: "videos",
      title: "Vidéos",
      icon: Film,
      access: "Tous",
      description: "Cours enregistrés et séances en direct",
      resources: [
        { type: "video", title: "Introduction à la Prorascience — Module 1", date: "2024-01-20", duration: "45 min" },
        { type: "video", title: "Le Concept de l'Âme — Cours complet", date: "2024-02-05", duration: "1h 12 min" },
        { type: "video", title: "Potentia Prima — Séance live", date: "2024-03-10", duration: "58 min" },
        { type: "video", title: "Les 10 Équations Fondamentales", date: "2024-03-25", duration: "1h 30 min" },
        { type: "video", title: "Exercices de Perception Visuelle", date: "2024-04-01", duration: "32 min" }
      ]
    },
    {
      id: "pdf",
      title: "PDFs & Documents",
      icon: FileText,
      access: "Tous",
      description: "Fichiers PDF téléchargeables",
      resources: [
        { type: "pdf", title: "Introduction à la Prorascience", date: "2024-01-15", pages: "42 pages" },
        { type: "pdf", title: "Guide du Rêve Lucide", date: "2024-02-01", pages: "28 pages" },
        { type: "pdf", title: "Symbolisme des Couleurs", date: "2024-03-12", pages: "15 pages" },
        { type: "pdf", title: "Règles de Vie de l'Académie", date: "2023-11-20", pages: "8 pages" },
        { type: "pdf", title: "Calendrier Lunaire 2024", date: "2024-01-01", pages: "12 pages" },
        { type: "pdf", title: "Guide Pédagogique du Mentorat", date: "2024-02-20", pages: "35 pages" },
        { type: "pdf", title: "Arcanes Majeurs — Enseignements Avancés", date: "2024-04-01", pages: "60 pages" }
      ]
    },
    {
      id: "glossaire",
      title: "Glossaire",
      icon: BookMarked,
      access: "Tous",
      description: "Terminologie et définitions Prorascience",
      resources: [
        { type: "article", title: "Terminologie Prorascientifique — Tome I", date: "2023-09-01" },
        { type: "article", title: "Glossaire des Cordes Énergétiques", date: "2023-10-15" },
        { type: "article", title: "Lexique du Potentia Prima", date: "2024-01-10" },
        { type: "article", title: "Définitions : Ontodynamique", date: "2024-02-28" }
      ]
    },
    {
      id: "rituels",
      title: "Rituels",
      icon: ScrollText,
      access: "Académique+",
      description: "Pratiques rituelles et exercices spirituels",
      resources: [
        { type: "pdf", title: "Rituel Matinal — Protocole complet", date: "2024-01-05" },
        { type: "video", title: "Démonstration — Rituel de l'Aube", date: "2024-02-14" },
        { type: "audio", title: "Méditation Guidée du Soir", date: "2024-02-03", duration: "22 min" },
        { type: "pdf", title: "Cercle de Protection — Instructions", date: "2024-03-07" },
        { type: "audio", title: "Invocation des Forces Nocturnes", date: "2024-04-12", duration: "18 min" }
      ]
    },
    {
      id: "rapports",
      title: "Rapports de cours",
      icon: ClipboardList,
      access: "Tous",
      description: "Comptes-rendus et synthèses de séances",
      resources: [
        { type: "pdf", title: "Synthèse — Cours du 15 janvier 2024", date: "2024-01-16" },
        { type: "pdf", title: "Compte-rendu — Séance live Module 2", date: "2024-02-08" },
        { type: "pdf", title: "Résumé — Conférence Potentia Prima", date: "2024-03-12" },
        { type: "pdf", title: "Notes de cours — Les 10 Équations", date: "2024-03-26" }
      ]
    },
    {
      id: "audio",
      title: "Audio",
      icon: Mic,
      access: "Tous",
      description: "Enregistrements audio et méditations",
      resources: [
        { type: "audio", title: "Méditation du Matin — 10 min", date: "2024-01-08", duration: "10 min" },
        { type: "audio", title: "Méditation du Soir — 20 min", date: "2024-02-03", duration: "20 min" },
        { type: "audio", title: "Conférence audio — Histoire de l'Ordre", date: "2023-12-05", duration: "1h 05 min" },
        { type: "audio", title: "Récitation des Équations Fondamentales", date: "2024-03-18", duration: "15 min" }
      ]
    },
    {
      id: "officiels",
      title: "Documents officiels",
      icon: FolderOpen,
      access: "Tous",
      description: "Règlements, certificats et attestations",
      resources: [
        { type: "pdf", title: "Règlement Intérieur de l'Académie", date: "2023-09-01" },
        { type: "pdf", title: "Charte de l'Élève", date: "2023-09-01" },
        { type: "pdf", title: "Modèle de Certificat de Formation", date: "2024-01-01" },
        { type: "pdf", title: "Attestation de Participation", date: "2024-01-01" },
        { type: "pdf", title: "Programme Officiel — Année 1", date: "2024-09-01" }
      ]
    }
  ];

  const getIcon = (type) => {
    switch(type) {
      case 'pdf': return <FileText className="w-4 h-4 text-red-400" />;
      case 'video': return <Video className="w-4 h-4 text-blue-400" />;
      case 'audio': return <Mic className="w-4 h-4 text-purple-400" />;
      default: return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  if (embedded) {
    return <EmbeddedResources />;
  }

  return (
    <div className="min-h-screen bg-[#0F1419] font-sans pb-20">
      <Helmet>
        <title>Bibliothèque & Archives - PRORASCIENCE ACADEMY</title>
      </Helmet>

      {/* Hero Section */}
      <section className="relative h-[400px] w-full overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1554896485-c6d2cc4111a8?q=80&w=2000&auto=format&fit=crop" 
            alt="Library" 
            className="w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-[#0F1419]/70 backdrop-blur-[2px]" />
        </div>
        
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          >
             <div className="mx-auto w-16 h-16 bg-[#D4AF37]/20 rounded-full flex items-center justify-center mb-6 border border-[#D4AF37]">
                <BookOpen className="w-8 h-8 text-[#D4AF37]" />
             </div>
            <h1 className="text-4xl lg:text-5xl font-serif font-bold text-white mb-6">Grande Bibliothèque du Savoir</h1>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              "La connaissance est un trésor, mais la pratique est la clé." - Accédez à l'ensemble des ressources numérisées de l\'Ordre.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Tools Bar */}
      <div className="sticky top-20 z-40 bg-[#0F1419]/95 backdrop-blur-xl border-y border-white/10 py-4 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
            <Input 
              placeholder="Rechercher..." 
              className="pl-10 bg-[#192734] border-white/10 text-white focus:border-[#D4AF37]/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="border-white/10 text-gray-300 hover:text-white"><Filter className="w-4 h-4 mr-2"/> Filtrer</Button>
            <Button variant="outline" size="sm" className="border-white/10 text-gray-300 hover:text-white"><Bookmark className="w-4 h-4 mr-2"/> Favoris</Button>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-6">
        {categories.map((cat) => (
          <ExpandableCard key={cat.id} title={cat.title} icon={cat.icon}>
             <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                <span className="text-xs uppercase tracking-wider text-gray-500 font-bold">Accès : <span className="text-[#D4AF37]">{cat.access}</span></span>
                <span className="text-sm text-gray-500">{cat.resources.length} ressources</span>
             </div>
             <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cat.resources.map((res, idx) => (
                   <div key={idx} className="bg-black/20 p-4 rounded-lg hover:bg-black/40 transition-colors flex items-start gap-3 group cursor-pointer border border-transparent hover:border-[#D4AF37]/20">
                      <div className="mt-1">{getIcon(res.type)}</div>
                      <div className="flex-1">
                         <h4 className="text-white font-medium text-sm group-hover:text-[#D4AF37] transition-colors">{res.title}</h4>
                         <p className="text-sm text-gray-500 mt-1">{res.date}</p>
                      </div>
                      <Download className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors opacity-0 group-hover:opacity-100" />
                   </div>
                ))}
             </div>
          </ExpandableCard>
        ))}
      </div>

      {/* Footer Notice */}
      <div className="text-center text-gray-500 text-sm mt-12 pb-8">
         <p>Dernière mise à jour de la base de données : {new Date().toLocaleDateString()}</p>
         <p>L'accès à certains documents est soumis à votre niveau d\'initiation.</p>
      </div>
    </div>
  );
};

export default LibraryPage;