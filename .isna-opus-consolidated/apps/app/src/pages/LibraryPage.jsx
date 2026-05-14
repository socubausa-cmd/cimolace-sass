import React, { useState } from 'react';
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
  Filter
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ExpandableCard from '@/components/ui/ExpandableCard';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';

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
    return (
      <div className="space-y-8 pb-8">
        <Helmet><title>Ressources | PRORASCIENCE</title></Helmet>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#D4AF37]/10 rounded-xl border border-[#D4AF37]/20">
            <BookOpen className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-white">Bibliothèque du Savoir</h1>
            <p className="text-gray-400 text-sm">Ressources et documents numérisés de l&apos;Ordre</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
          <Input
            placeholder="Rechercher une ressource..."
            className="pl-10 bg-[#192734] border-white/10 text-white focus:border-[#D4AF37]/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Tabs par catégorie */}
        <Tabs value={activeEmbeddedCategory} onValueChange={setActiveEmbeddedCategory} className="space-y-6">
          <PremiumSegmentedSelector
            value={activeEmbeddedCategory}
            onChange={setActiveEmbeddedCategory}
            options={categories.map((cat) => ({
              value: cat.id,
              label: cat.title.split(' ').slice(0, 2).join(' '),
              badge: `${cat.resources.length}`,
              icon: cat.icon,
            }))}
            layoutId="library-embedded-category-segment-pill"
            compact
            showChevron={false}
          />

          {categories.map((cat) => {
            const filtered = cat.resources.filter(r =>
              !searchTerm || r.title.toLowerCase().includes(searchTerm.toLowerCase())
            );
            return (
              <TabsContent key={cat.id} value={cat.id} className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">{cat.title}</h2>
                    <span className="text-xs text-[#D4AF37] font-semibold uppercase tracking-wider">Accès : {cat.access}</span>
                  </div>
                  <span className="text-sm text-gray-500">{filtered.length} ressource{filtered.length > 1 ? 's' : ''}</span>
                </div>
                {filtered.length === 0 ? (
                  <p className="text-gray-500 text-sm py-6 text-center">Aucune ressource ne correspond.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((res, idx) => (
                      <div key={idx} className="bg-[#192734]/60 border border-white/5 p-4 rounded-xl hover:border-[#D4AF37]/30 hover:bg-[#192734] transition-all cursor-pointer group flex items-start gap-3">
                        <div className="mt-0.5 p-2 rounded-lg bg-black/30 shrink-0">{getIcon(res.type)}</div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-white group-hover:text-[#D4AF37] transition-colors text-sm truncate">{res.title}</h4>
                          <p className="text-xs text-gray-500 mt-1">{res.date}</p>
                          <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-white/5 text-gray-400 uppercase tracking-wider">{res.type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    );
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
              "La connaissance est un trésor, mais la pratique est la clé." - Accédez à l'ensemble des ressources numérisées de l'Ordre.
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
         <p>L'accès à certains documents est soumis à votre niveau d'initiation.</p>
      </div>
    </div>
  );
};

export default LibraryPage;