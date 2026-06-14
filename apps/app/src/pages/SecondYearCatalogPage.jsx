import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Helmet } from 'react-helmet';
import { Search, Filter, Layers, BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ModuleCard from '@/components/modules/ModuleCard';

const SecondYearCatalogPage = () => {
  const { user } = useAuth();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPart, setSelectedPart] = useState('All');

  useEffect(() => {
    fetchModules();
  }, []);

  const fetchModules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('modules_year2_complete')
        .select('*')
        .order('order');
      
      if (error) throw error;
      setModules(data || []);
    } catch (error) {
      console.error('Error fetching modules:', error);
    } finally {
      setLoading(false);
    }
  };

  // Grouping Logic
  const parts = [...new Set(modules.map(m => m.part))];
  
  const filteredModules = modules.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          m.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPart = selectedPart === 'All' || m.part === selectedPart;
    return matchesSearch && matchesPart;
  });

  const groupedModules = parts.reduce((acc, part) => {
    const partModules = filteredModules.filter(m => m.part === part);
    if (partModules.length > 0) {
      acc[part] = partModules;
    }
    return acc;
  }, {});

  if (loading) return (
    <div className="min-h-screen bg-[#0F1419] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[var(--school-accent)] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-20">
      <Helmet>
        <title>Catalogue 2ème Année | PRORASCIENCE</title>
        <meta name="description" content="Catalogue complet des modules de 2ème année : Science des Totems, Physique de la Conscience, et plus." />
      </Helmet>

      {/* Hero */}
      <section className="relative px-6 py-16 bg-[#151a21] border-b border-white/5 mb-12">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-6">Cycle Avancé : Les 7 Piliers</h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-10">
            Explorez les 34 modules de la deuxième année, structurés pour vous guider de la compréhension totémique à l'ascension finale.
          </p>
          
          {/* Search & Filter Bar */}
          <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-3.5 text-gray-500 w-5 h-5" />
              <Input 
                type="text" 
                placeholder="Rechercher un module (ex: Merkaba, M15)..." 
                className="pl-10 bg-[#0F1419] border-white/10 h-12"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select 
              className="bg-[#0F1419] border border-white/10 rounded-md px-4 h-12 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--school-accent)]"
              value={selectedPart}
              onChange={(e) => setSelectedPart(e.target.value)}
            >
              <option value="All">Toutes les Parties</option>
              {parts.map(part => (
                <option key={part} value={part}>{part}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Module List by Part */}
      <div className="max-w-7xl mx-auto px-6 space-y-16">
        {Object.keys(groupedModules).length > 0 ? (
          Object.keys(groupedModules).map(part => (
            <section key={part} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex items-center gap-4 mb-8 border-b border-white/10 pb-4">
                <Layers className="w-8 h-8 text-[var(--school-accent)]" />
                <h2 className="text-3xl font-bold font-serif">{part}</h2>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {groupedModules[part].map(module => (
                  <ModuleCard key={module.id} module={module} />
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="text-center py-20 text-gray-500">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-xl">Aucun module trouvé pour votre recherche.</p>
            <Button 
              variant="link" 
              className="text-[var(--school-accent)]" 
              onClick={() => { setSearchTerm(''); setSelectedPart('All'); }}
            >
              Réinitialiser les filtres
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecondYearCatalogPage;