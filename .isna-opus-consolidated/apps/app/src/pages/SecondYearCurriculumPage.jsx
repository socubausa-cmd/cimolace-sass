import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  BookOpen, Target, Layers, Clock, Award, CheckCircle, 
  Calendar, Users, BarChart, Search, Filter, Grid, List, 
  ChevronDown, Download, Star, MessageCircle, Lock, 
  Unlock, PlayCircle, FileText, Headphones, Video, 
  ArrowRight, Shield, Zap, GraduationCap, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from '@/components/ui/separator';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';

// --- MOCK DATA ---
const modulesData = [
  // Part II (5 modules)
  { id: 'S1', title: "Fondements de la Cosmologie Totémique", part: "II", duration: 3, level: "Intermédiaire", status: "active", professor: "Prof. Diallo", type: "Théorique" },
  { id: 'S2', title: "Les 4 Éléments et la Matière", part: "II", duration: 3, level: "Intermédiaire", status: "active", professor: "Prof. Diallo", type: "Théorique" },
  { id: 'S3', title: "L'Hypostase des Ancêtres", part: "II", duration: 3, level: "Intermédiaire", status: "active", professor: "Prof. Kimbembe", type: "Mystique" },
  { id: 'S4', title: "Géométrie Sacrée Africaine", part: "II", duration: 3, level: "Avancé", status: "locked", professor: "Prof. Nkosi", type: "Pratique" },
  { id: 'S5', title: "Le Verbe Créateur (Nommo)", part: "II", duration: 3, level: "Avancé", status: "locked", professor: "Prof. Kimbembe", type: "Mystique" },
  
  // Part III (4 modules)
  { id: 'S6', title: "Les Lois de Maât Appliquées", part: "III", duration: 3, level: "Intermédiaire", status: "locked", professor: "Prof. Diallo", type: "Théorique" },
  { id: 'S7', title: "Éthique et Responsabilité", part: "III", duration: 2, level: "Intermédiaire", status: "locked", professor: "Prof. Nkosi", type: "Théorique" },
  { id: 'S8', title: "La Justice Cosmique", part: "III", duration: 3, level: "Avancé", status: "locked", professor: "Prof. Kimbembe", type: "Mystique" },
  { id: 'S9', title: "Purification et Harmonie", part: "III", duration: 2, level: "Intermédiaire", status: "locked", professor: "Prof. Nkosi", type: "Pratique" },

  // Part IV (10 modules)
  { id: 'S10', title: "Anatomie Occulte de l'Homme", part: "IV", duration: 4, level: "Avancé", status: "locked", professor: "Prof. Kimbembe", type: "Théorique" },
  { id: 'S11', title: "Les 7 Corps Subtils", part: "IV", duration: 4, level: "Avancé", status: "locked", professor: "Prof. Nkosi", type: "Pratique" },
  { id: 'S12', title: "Le Double Éthérique", part: "IV", duration: 3, level: "Avancé", status: "locked", professor: "Prof. Kimbembe", type: "Mystique" },
  { id: 'S13', title: "Chakras et Centres d'Énergie", part: "IV", duration: 3, level: "Intermédiaire", status: "locked", professor: "Prof. Nkosi", type: "Pratique" },
  { id: 'S14', title: "L'Aura et le Rayonnement", part: "IV", duration: 3, level: "Intermédiaire", status: "locked", professor: "Prof. Kimbembe", type: "Mystique" },
  { id: 'S15', title: "Hygiène Spirituelle", part: "IV", duration: 2, level: "Débutant", status: "locked", professor: "Prof. Nkosi", type: "Pratique" },
  { id: 'S16', title: "Protection Psychique", part: "IV", duration: 3, level: "Avancé", status: "locked", professor: "Prof. Kimbembe", type: "Pratique" },
  { id: 'S17', title: "Vampirisme Énergétique", part: "IV", duration: 2, level: "Intermédiaire", status: "locked", professor: "Prof. Nkosi", type: "Théorique" },
  { id: 'S18', title: "Guérison Spirituelle (Base)", part: "IV", duration: 4, level: "Avancé", status: "locked", professor: "Prof. Kimbembe", type: "Pratique" },
  { id: 'S19', title: "Méditation Transcendantale", part: "IV", duration: 3, level: "Intermédiaire", status: "locked", professor: "Prof. Nkosi", type: "Pratique" },

  // Part V (5 modules)
  { id: 'S20', title: "Thanatologie Africaine", part: "V", duration: 3, level: "Avancé", status: "locked", professor: "Prof. Diallo", type: "Théorique" },
  { id: 'S21', title: "Le Processus de la Mort", part: "V", duration: 3, level: "Avancé", status: "locked", professor: "Prof. Diallo", type: "Théorique" },
  { id: 'S22', title: "Accompagnement des Âmes", part: "V", duration: 4, level: "Expert", status: "locked", professor: "Prof. Nkosi", type: "Pratique" },
  { id: 'S23', title: "Rituels de Passage", part: "V", duration: 4, level: "Expert", status: "locked", professor: "Prof. Kimbembe", type: "Mystique" },
  { id: 'S24', title: "Le Monde des Ancêtres", part: "V", duration: 3, level: "Intermédiaire", status: "locked", professor: "Prof. Nkosi", type: "Pratique" },

  // Part VI (5 modules)
  { id: 'S25', title: "Loi du Karma (Action-Réaction)", part: "VI", duration: 3, level: "Avancé", status: "locked", professor: "Prof. Kimbembe", type: "Théorique" },
  { id: 'S26', title: "Dettes Karmiques et Libération", part: "VI", duration: 3, level: "Avancé", status: "locked", professor: "Prof. Nkosi", type: "Pratique" },
  { id: 'S27', title: "Le Dharma (Mission de Vie)", part: "VI", duration: 3, level: "Intermédiaire", status: "locked", professor: "Prof. Kimbembe", type: "Mystique" },
  { id: 'S28', title: "Lecture des Signes", part: "VI", duration: 2, level: "Intermédiaire", status: "locked", professor: "Prof. Nkosi", type: "Pratique" },
  { id: 'S29', title: "Maîtrise du Destin", part: "VI", duration: 3, level: "Expert", status: "locked", professor: "Prof. Kimbembe", type: "Mystique" },

  // Part VII (3 modules)
  { id: 'S30', title: "Cycles Cosmiques et Humains", part: "VII", duration: 3, level: "Avancé", status: "locked", professor: "Prof. Diallo", type: "Théorique" },
  { id: 'S31', title: "Astrologie Sidérale Africaine", part: "VII", duration: 4, level: "Expert", status: "locked", professor: "Prof. Nkosi", type: "Pratique" },
  { id: 'S32', title: "Les Rythmes de la Nature", part: "VII", duration: 2, level: "Intermédiaire", status: "locked", professor: "Prof. Kimbembe", type: "Pratique" },

  // Part VIII (2 modules)
  { id: 'S33', title: "Synthèse et Intégration", part: "VIII", duration: 2, level: "Expert", status: "locked", professor: "Prof. Nkosi", type: "Pratique" },
  { id: 'S34', title: "Initiation Finale de 2ème Année", part: "VIII", duration: 4, level: "Expert", status: "locked", professor: "Prof. Kimbembe", type: "Mystique" }
];

const testimonials = [
  { id: 1, name: "Jean-Paul M.", date: "Nov 2024", role: "Étudiant Année 2", content: "La profondeur des enseignements sur la structure de l'être a totalement changé ma pratique médicale.", rating: 5 },
  { id: 2, name: "Sarah K.", date: "Oct 2024", role: "Transmetteur Certifié", content: "Une rigueur scientifique alliée à une spiritualité authentique. Le module sur la mort est bouleversant.", rating: 5 },
  { id: 3, name: "Michel T.", date: "Déc 2024", role: "Étudiant Année 2", content: "Je comprends enfin les lois du Karma. Ce n'est plus une théorie, c'est une carte routière pour ma vie.", rating: 4.8 },
  { id: 4, name: "Amina B.", date: "Jan 2025", role: "Étudiant Année 3", content: "L'enseignement du Prof. Kimbembe est un trésor. Merci pour cette clarté.", rating: 5 },
];

const SecondYearCurriculumPage = () => {
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [partFilter, setPartFilter] = useState('All');
  const [levelFilter, setLevelFilter] = useState('All');
  const [calendarTab, setCalendarTab] = useState('t1');
  
  // Stats Calculation
  const totalModules = modulesData.length;
  const completedModules = 0; // Mock progress
  const progressPercentage = (completedModules / totalModules) * 100;

  // Filter Logic
  const filteredModules = modulesData.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(searchTerm.toLowerCase()) || m.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPart = partFilter === 'All' || m.part === partFilter;
    const matchesLevel = levelFilter === 'All' || m.level === levelFilter;
    return matchesSearch && matchesPart && matchesLevel;
  });

  return (
    <div className="min-h-screen bg-[#0F1419] font-sans text-gray-300 pt-20">
      <Helmet>
        <title>Année 2 - Lois Cosmologiques et Mort | PRORASCIENCE</title>
        <meta name="description" content="Programme de 2ème année : Lois Cosmologiques, Structure de l'Être et Thanatologie." />
      </Helmet>

      {/* --- TASK 1: HERO SECTION --- */}
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden py-20 border-b border-white/5">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=2094&auto=format&fit=crop')] bg-cover bg-center opacity-10" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0F1419]/90 via-[#0F1419]/80 to-[#0F1419]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#D4AF37]/10 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="flex flex-wrap justify-center gap-3 mb-6">
              <Badge variant="outline" className="border-[#D4AF37] text-[#D4AF37] px-4 py-1 uppercase tracking-widest backdrop-blur-md">Niveau Intermédiaire - Avancé</Badge>
              <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30">Théorique + Pratique</Badge>
              <Badge className="bg-green-500/20 text-green-400 border border-green-500/30">Statut : Actif</Badge>
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-bold text-white mb-6 leading-tight">
              Année 2 <span className="text-[#D4AF37]">Lois Cosmologiques</span> & Mort
            </h1>
            
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-10 leading-relaxed font-light">
              Une exploration approfondie des lois universelles, de la structure subtile de l'être humain et des mystères de la transition vers l'au-delà.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto bg-[#192734]/50 backdrop-blur-md p-6 rounded-2xl border border-white/10">
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-1">34</div>
                <div className="text-xs uppercase tracking-wide text-gray-400">Modules</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-1">~100h</div>
                <div className="text-xs uppercase tracking-wide text-gray-400">Formation</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-1">3</div>
                <div className="text-xs uppercase tracking-wide text-gray-400">Trimestres</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-[#D4AF37] mb-1">Gratuit</div>
                <div className="text-xs uppercase tracking-wide text-gray-400">Accès</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* --- OBJECTIVES --- */}
      <section className="py-16 px-6 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-5 gap-4">
          {[
            { title: "Lois Cosmologiques", icon: Layers, desc: "Comprendre les mécanismes régissant l'univers visible et invisible." },
            { title: "Structure Humaine", icon: Users, desc: "Maîtriser l'anatomie occulte : corps subtils, chakras, aura." },
            { title: "Processus de Mort", icon: Calendar, desc: "Étudier la thanatologie africaine et l'accompagnement des âmes." },
            { title: "Karma & Destin", icon: Target, desc: "Décoder les lois de cause à effet et la mission de vie." },
            { title: "Rites & Éthique", icon: Award, desc: "Pratiquer les rites de passage avec une éthique irréprochable." }
          ].map((obj, i) => (
            <motion.div 
              key={i} 
              whileHover={{ y: -5 }}
              className="bg-[#192734] p-6 rounded-xl border border-white/5 text-center hover:border-[#D4AF37]/30 transition-all"
            >
              <obj.icon className="w-10 h-10 text-[#D4AF37] mx-auto mb-4" />
              <h3 className="text-sm font-bold text-white mb-2 uppercase">{obj.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{obj.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* --- TASK 4: PROGRESS & STATS --- */}
      <section className="py-12 px-6 max-w-7xl mx-auto mb-16">
        <div className="bg-gradient-to-r from-[#192734] to-[#15202B] rounded-2xl p-8 border border-white/10 shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-end mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                <BarChart className="w-6 h-6 text-[#D4AF37]" /> Votre Progression
              </h2>
              <p className="text-gray-400 text-sm">Modules complétés : {completedModules} / {totalModules} ({progressPercentage}%)</p>
            </div>
            <div className="text-right hidden md:block">
              <div className="text-white font-bold text-lg">~100 Heures</div>
              <div className="text-[#D4AF37] text-sm">~8h / semaine</div>
            </div>
          </div>
          <Progress value={progressPercentage} className="h-4 bg-black/40" indicatorClassName="bg-gradient-to-r from-[#D4AF37] to-yellow-600" />
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mt-8">
            {['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'].map((part) => {
              const count = modulesData.filter(m => m.part === part).length;
              return (
                <div key={part} className="bg-black/20 p-3 rounded-lg text-center border border-white/5">
                  <div className="text-sm text-gray-500 font-bold uppercase mb-1">Partie {part}</div>
                  <div className="text-white font-bold">0 / {count}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* --- TASK 2 & 3: MODULES BROWSER --- */}
      <section className="py-16 px-6 max-w-7xl mx-auto" id="modules">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h2 className="text-3xl font-serif font-bold text-white">Programme Détaillé</h2>
          
          <div className="flex items-center gap-3 bg-[#192734] p-2 rounded-lg border border-white/10">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setViewMode('grid')}
              className={`${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setViewMode('table')}
              className={`${viewMode === 'table' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-3 text-gray-500 w-4 h-4" />
            <Input 
              placeholder="Rechercher un module..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#192734] border-white/10 text-white"
            />
          </div>
          <select 
            className="bg-[#192734] text-white border border-white/10 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
            value={partFilter}
            onChange={(e) => setPartFilter(e.target.value)}
          >
            <option value="All">Toutes les Parties</option>
            {['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'].map(p => <option key={p} value={p}>Partie {p}</option>)}
          </select>
          <select 
            className="bg-[#192734] text-white border border-white/10 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
          >
            <option value="All">Tous les Niveaux</option>
            <option value="Intermédiaire">Intermédiaire</option>
            <option value="Avancé">Avancé</option>
            <option value="Expert">Expert</option>
          </select>
        </div>

        {/* View Rendering */}
        {viewMode === 'grid' ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredModules.map(module => (
              <motion.div 
                key={module.id}
                layout
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                whileHover={{ y: -5 }}
                className="bg-[#192734] rounded-xl overflow-hidden border border-white/5 hover:border-[#D4AF37]/50 transition-all group"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <Badge variant="outline" className="border-[#D4AF37] text-[#D4AF37] font-bold">{module.id}</Badge>
                    {module.status === 'active' ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Lock className="w-5 h-5 text-gray-600" />
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 line-clamp-2 group-hover:text-[#D4AF37] transition-colors">{module.title}</h3>
                  <p className="text-sm text-gray-400 mb-4 flex items-center gap-2">
                    <Users className="w-3 h-3" /> {module.professor}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-500 bg-black/20 p-3 rounded-lg">
                    <div>Partie {module.part}</div>
                    <div className="text-right">{module.duration}h</div>
                    <div>{module.level}</div>
                    <div className="text-right text-[#D4AF37]">{module.type}</div>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-white/5 bg-black/20 flex justify-between items-center">
                  <span className="text-sm text-gray-500">Statut: {module.status === 'active' ? 'Ouvert' : 'Verrouillé'}</span>
                  <Link to={`/year2-modules/${module.id}`}>
                    <Button size="sm" variant="ghost" className="hover:text-[#D4AF37] p-0 h-auto font-bold">
                      Détails <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 overflow-hidden bg-[#192734]">
            <Table>
              <TableHeader className="bg-black/30">
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-[#D4AF37]">Code</TableHead>
                  <TableHead className="text-white">Titre</TableHead>
                  <TableHead className="text-white">Partie</TableHead>
                  <TableHead className="text-white">Durée</TableHead>
                  <TableHead className="text-white">Niveau</TableHead>
                  <TableHead className="text-white">Professeur</TableHead>
                  <TableHead className="text-white">Type</TableHead>
                  <TableHead className="text-right text-white">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredModules.map((module) => (
                  <TableRow key={module.id} className="border-white/5 hover:bg-white/5">
                    <TableCell className="font-bold text-[#D4AF37]">{module.id}</TableCell>
                    <TableCell className="font-medium text-gray-300">{module.title}</TableCell>
                    <TableCell>Partie {module.part}</TableCell>
                    <TableCell>{module.duration}h</TableCell>
                    <TableCell><Badge variant="secondary" className="bg-white/10 text-xs">{module.level}</Badge></TableCell>
                    <TableCell className="text-gray-400 text-sm">{module.professor}</TableCell>
                    <TableCell className="text-gray-400 text-sm">{module.type}</TableCell>
                    <TableCell className="text-right">
                      <Link to={`/year2-modules/${module.id}`}>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <ArrowRight className="w-4 h-4 text-gray-400 hover:text-[#D4AF37]" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* --- TASK 5 & 6: PREREQUISITES & RESOURCES --- */}
      <section className="py-16 bg-[#15202B] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12">
          
          {/* Prerequisites */}
          <div>
            <h2 className="text-2xl font-serif font-bold text-white mb-6 flex items-center gap-3">
              <Shield className="w-6 h-6 text-[#D4AF37]" /> Prérequis & Recommandations
            </h2>
            <div className="space-y-6">
              <div className="bg-[#192734] p-5 rounded-xl border-l-4 border-red-500">
                <h3 className="font-bold text-white mb-2">Obligatoire</h3>
                <ul className="text-sm text-gray-400 space-y-2 list-disc pl-4">
                  <li>Année 1 (Cycle des Fondements) entièrement validée.</li>
                  <li>Compréhension des concepts fondamentaux (Maât, Totem, Atome).</li>
                  <li>Engagement personnel écrit.</li>
                </ul>
              </div>
              <div className="bg-[#192734] p-5 rounded-xl border-l-4 border-[#D4AF37]">
                <h3 className="font-bold text-white mb-2">Recommandé</h3>
                <ul className="text-sm text-gray-400 space-y-2 list-disc pl-4">
                  <li>Pratique régulière de la méditation (20 min/jour).</li>
                  <li>Ouverture d'esprit et curiosité intellectuelle.</li>
                  <li>Disponibilité d'étude (min. 8h/semaine).</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Resources */}
          <div>
             <h2 className="text-2xl font-serif font-bold text-white mb-6 flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-[#D4AF37]" /> Ressources Pédagogiques
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-[#192734] p-4 rounded-xl flex items-center gap-3 border border-white/5">
                <FileText className="w-8 h-8 text-blue-400" />
                <div>
                  <div className="text-2xl font-bold text-white">100+</div>
                  <div className="text-sm text-gray-400">Documents PDF</div>
                </div>
              </div>
              <div className="bg-[#192734] p-4 rounded-xl flex items-center gap-3 border border-white/5">
                <Video className="w-8 h-8 text-red-400" />
                <div>
                  <div className="text-2xl font-bold text-white">85+</div>
                  <div className="text-sm text-gray-400">Vidéos de Cours</div>
                </div>
              </div>
              <div className="bg-[#192734] p-4 rounded-xl flex items-center gap-3 border border-white/5">
                <Headphones className="w-8 h-8 text-purple-400" />
                <div>
                  <div className="text-2xl font-bold text-white">40+</div>
                  <div className="text-sm text-gray-400">Audio / Méditations</div>
                </div>
              </div>
              <div className="bg-[#192734] p-4 rounded-xl flex items-center gap-3 border border-white/5">
                <GraduationCap className="w-8 h-8 text-[#D4AF37]" />
                <div>
                  <div className="text-2xl font-bold text-white">95+</div>
                  <div className="text-sm text-gray-400">Exercices Pratiques</div>
                </div>
              </div>
            </div>
            <Button className="w-full bg-[#192734] hover:bg-white/5 text-[#D4AF37] border border-[#D4AF37]/30">
              Accéder à la Bibliothèque Complète
            </Button>
          </div>
        </div>
      </section>

      {/* --- TASK 7: PROFESSORS --- */}
      <section className="py-16 px-6 max-w-7xl mx-auto">
        <h2 className="text-3xl font-serif font-bold text-white mb-10 text-center">Vos Mentors pour l'Année 2</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { 
              name: "Prof. Kimbembe", 
              role: "Recteur ISNA", 
              spec: "Cosmologie, Rites, Transmission", 
              modules: "S3, S5, S8, S10, S12...",
              avail: "Mar/Jeu 18h-20h",
              rating: "4.9/5"
            },
            { 
              name: "Prof. Diallo", 
              role: "Doyen des Études", 
              spec: "Équations, Cycles Cosmiques", 
              modules: "S1, S2, S6, S20, S21, S30",
              avail: "Lun/Mer 18h-20h",
              rating: "4.8/5"
            },
            { 
              name: "Prof. Nkosi", 
              role: "Maître de Pratique", 
              spec: "Pratique, Mort, Éthique", 
              modules: "S4, S7, S9, S11, S13...",
              avail: "Mer/Ven 18h-20h",
              rating: "4.9/5"
            }
          ].map((prof, i) => (
            <div key={i} className="bg-[#192734] rounded-2xl overflow-hidden border border-white/5 hover:shadow-xl hover:shadow-[#D4AF37]/10 transition-all group">
              <div className="h-24 bg-gradient-to-r from-[#D4AF37]/20 to-black/50" />
              <div className="px-6 pb-6 -mt-12 relative">
                <div className="w-24 h-24 rounded-full bg-gray-700 border-4 border-[#0F1419] mx-auto mb-4 flex items-center justify-center text-2xl font-serif text-gray-400">
                  {prof.name.charAt(6)}
                </div>
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-white">{prof.name}</h3>
                  <p className="text-[#D4AF37] text-sm">{prof.role}</p>
                </div>
                <div className="space-y-3 text-sm text-gray-400">
                  <div className="flex items-center gap-2"><Award className="w-4 h-4 text-[#D4AF37]"/> Spécialité: {prof.spec}</div>
                  <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-[#D4AF37]"/> Dispo: {prof.avail}</div>
                  <div className="flex items-center gap-2"><Star className="w-4 h-4 text-[#D4AF37]"/> Note: {prof.rating}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- TASK 8 & 9: CALENDAR & EVALUATION --- */}
      <section className="py-16 bg-[#192734]/30">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12">
          
          {/* Calendar Tabs */}
          <div>
            <h2 className="text-2xl font-serif font-bold text-white mb-6">Calendrier Académique 2025</h2>
            <Tabs value={calendarTab} onValueChange={setCalendarTab} className="w-full">
              <PremiumSegmentedSelector
                value={calendarTab}
                onChange={setCalendarTab}
                options={[
                  { value: 't1', label: 'Trimestre 1' },
                  { value: 't2', label: 'Trimestre 2' },
                  { value: 't3', label: 'Trimestre 3' },
                ]}
                layoutId="second-year-calendar-tab-segment-pill"
                className="mb-2"
                compact
                showChevron={false}
              />
              <TabsContent value="t1" className="bg-[#192734] p-6 rounded-b-xl border border-t-0 border-white/5">
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-white">
                    <span className="font-bold">Période</span>
                    <span>Jan - Mar 2025</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-400 text-sm">
                    <span>Modules</span>
                    <span>S1 - S5</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-400 text-sm">
                    <span>Examens</span>
                    <span className="text-red-400">24 - 28 Mar</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-400 text-sm">
                    <span>Vacances</span>
                    <span className="text-green-400">1 - 14 Avr</span>
                  </div>
                </div>
              </TabsContent>
              {/* Other tabs content simplified for length */}
              <TabsContent value="t2" className="bg-[#192734] p-6 rounded-b-xl border border-t-0 border-white/5 text-center text-gray-400">Avril - Juin 2025</TabsContent>
              <TabsContent value="t3" className="bg-[#192734] p-6 rounded-b-xl border border-t-0 border-white/5 text-center text-gray-400">Août - Oct 2025</TabsContent>
            </Tabs>

            <div className="mt-8">
              <h3 className="text-lg font-bold text-white mb-4">Emploi du Temps Hebdomadaire</h3>
              <div className="grid grid-cols-5 gap-2 text-center text-xs">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'].map(d => <div key={d} className="bg-[#D4AF37]/20 text-[#D4AF37] p-2 rounded">{d}</div>)}
                {['Diallo', 'Kimbembe', 'Mixte', 'Kimbembe', 'Nkosi'].map((p, i) => <div key={i} className="bg-[#192734] p-2 rounded text-gray-400 border border-white/5 py-4">{p}<br/>18h-20h</div>)}
              </div>
            </div>
          </div>

          {/* Evaluation & Certification */}
          <div>
            <h2 className="text-2xl font-serif font-bold text-white mb-6">Évaluation & Certification</h2>
            <div className="bg-[#192734] p-6 rounded-2xl border border-white/5 mb-6">
              <h3 className="font-bold text-white mb-4">Critères de Réussite</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm text-gray-400"><span>Participation</span><span>20%</span></div>
                <Progress value={20} className="h-1.5" />
                <div className="flex justify-between text-sm text-gray-400"><span>Exercices / Devoirs</span><span>30%</span></div>
                <Progress value={30} className="h-1.5" />
                <div className="flex justify-between text-sm text-gray-400"><span>Quiz Hebdo</span><span>20%</span></div>
                <Progress value={20} className="h-1.5" />
                <div className="flex justify-between text-sm text-gray-400"><span>Essais / Projets</span><span>30%</span></div>
                <Progress value={30} className="h-1.5" />
              </div>
              <div className="mt-4 text-center text-[#D4AF37] text-sm font-bold border-t border-white/10 pt-3">
                Moyenne minimale requise : 14/20
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1 bg-gradient-to-br from-[#D4AF37]/20 to-[#192734] p-4 rounded-xl border border-[#D4AF37]/30 text-center">
                <Award className="w-8 h-8 text-[#D4AF37] mx-auto mb-2" />
                <div className="font-bold text-white text-sm">Certificat Année 2</div>
                <div className="text-sm text-gray-400">Fin de Cycle</div>
              </div>
              <div className="flex-1 bg-[#192734] p-4 rounded-xl border border-white/5 text-center opacity-50">
                <GraduationCap className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <div className="font-bold text-white text-sm">Diplôme Transmetteur</div>
                <div className="text-sm text-gray-400">Après Année 3</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- TASK 10: TESTIMONIALS & CTA --- */}
      <section className="py-20 px-6 max-w-7xl mx-auto">
        <h2 className="text-3xl font-serif font-bold text-white mb-12 text-center">Témoignages Étudiants</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {testimonials.map((t) => (
            <div key={t.id} className="bg-[#192734] p-6 rounded-xl border border-white/5 relative">
              <div className="flex text-[#D4AF37] mb-3">
                {[...Array(5)].map((_, i) => <Star key={i} className={`w-3 h-3 ${i < Math.floor(t.rating) ? 'fill-current' : 'text-gray-600'}`} />)}
              </div>
              <p className="text-sm text-gray-300 italic mb-4 line-clamp-4">"{t.content}"</p>
              <div className="mt-auto pt-4 border-t border-white/5">
                <div className="font-bold text-white text-sm">{t.name}</div>
                <div className="text-sm text-gray-500">{t.role}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[#D4AF37] rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-black mb-6">Prêt pour l'Ascension ?</h2>
            <p className="text-black/80 max-w-2xl mx-auto mb-8 text-lg">
              Rejoignez la promotion 2025 et commencez votre transformation dès aujourd'hui. L'inscription est ouverte aux étudiants ayant validé le cycle 1.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button className="bg-black text-white hover:bg-gray-800 text-lg px-8 py-6 rounded-xl shadow-xl">
                S'inscrire à l'Année 2
              </Button>
              <Button variant="outline" className="bg-transparent border-black text-black hover:bg-black/10 text-lg px-8 py-6 rounded-xl">
                Télécharger le Programme (PDF)
              </Button>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default SecondYearCurriculumPage;