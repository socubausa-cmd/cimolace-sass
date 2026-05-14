import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  ShoppingCart, 
  Clock, 
  BookOpen, 
  UserCheck, 
  Star,
  ArrowRight,
  Globe,
  Zap
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const ModuleCatalogPage = () => {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchModules();
  }, []);

  const fetchModules = async () => {
    try {
      const { data, error } = await supabase
        .from('modules_year2')
        .select('*')
        .eq('status', 'active')
        .order('order');
      
      if (error) throw error;
      setModules(data);
    } catch (error) {
      console.error('Error fetching modules:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les modules.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (module) => {
    const currentCart = JSON.parse(localStorage.getItem('moduleCart') || '[]');
    if (currentCart.find(item => item.id === module.id)) {
      toast({ title: "Déjà dans le panier", description: "Ce module est déjà dans votre panier." });
      return;
    }
    const newCart = [...currentCart, module];
    localStorage.setItem('moduleCart', JSON.stringify(newCart));
    toast({ title: "Ajouté au panier", description: `${module.title} ajouté avec succès.` });
    // Dispatch custom event to update header cart count if implemented
    window.dispatchEvent(new Event('cartUpdated'));
  };

  const filteredModules = modules.filter(m => {
    const matchesType = filterType === 'all' || m.type === filterType;
    const matchesSearch = m.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          m.code.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const getTypeColor = (type) => {
    switch(type) {
      case 'fondamental': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'pratique': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'nocturne': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'sacerdotal': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-20">
      <Helmet>
        <title>Catalogue Modules 2ème Année | PRORASCIENCE</title>
      </Helmet>

      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div>
            <h1 className="text-4xl font-serif font-bold mb-2">Modules Autonomes (Année 2)</h1>
            <p className="text-gray-400">Perfectionnez votre maîtrise avec nos modules spécialisés à la carte.</p>
          </div>
          <Link to="/modules/panier">
            <Button variant="outline" className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10 gap-2">
              <ShoppingCart className="w-4 h-4" /> Panier
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8 bg-[#192734] p-4 rounded-xl border border-white/5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input 
              type="text" 
              placeholder="Rechercher par titre ou code..." 
              className="pl-10 bg-[#0F1419] border-white/10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {['all', 'fondamental', 'pratique', 'nocturne', 'sacerdotal'].map((type) => (
              <Button
                key={type}
                variant={filterType === type ? 'default' : 'ghost'}
                onClick={() => setFilterType(type)}
                className={`capitalize ${filterType === type ? 'bg-[#D4AF37] text-black' : 'text-gray-400'}`}
              >
                {type === 'all' ? 'Tous' : type}
              </Button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-20">Chargement des modules...</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-24">
            {filteredModules.map((module) => (
              <div key={module.id} className="bg-[#192734] border border-white/5 rounded-xl overflow-hidden hover:border-[#D4AF37]/30 transition-all group flex flex-col">
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <Badge variant="outline" className={`${getTypeColor(module.type)} uppercase text-xs font-bold px-2 py-0.5 border`}>
                      {module.type}
                    </Badge>
                    <span className="text-xs font-mono text-gray-500">{module.code}</span>
                  </div>
                  
                  <h3 className="text-xl font-bold mb-2 group-hover:text-[#D4AF37] transition-colors line-clamp-2">
                    {module.title}
                  </h3>
                  <p className="text-gray-400 text-sm mb-6 line-clamp-3">
                    {module.description}
                  </p>

                  <div className="flex gap-4 text-sm text-gray-400 mb-6">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-[#D4AF37]" /> {module.duration_weeks} sem.</span>
                    <span className="flex items-center gap-1"><BookOpen className="w-3 h-3 text-[#D4AF37]" /> {module.duration_hours}h</span>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {module.access_level?.includes('modulaire') && (
                      <Badge variant="secondary" className="bg-white/5 text-xs">Modulaire</Badge>
                    )}
                    {module.access_level?.includes('academique') && (
                      <Badge variant="secondary" className="bg-white/5 text-xs">Académique</Badge>
                    )}
                  </div>
                </div>

                <div className="p-6 pt-0 mt-auto border-t border-white/5">
                  <div className="flex items-center justify-between mb-4 mt-4">
                    <span className="text-2xl font-bold text-white">
                      {module.price > 0 ? `${module.price}€` : 'Inclus*'}
                    </span>
                    <span className="text-sm text-gray-500">*Académique</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Link to={`/modules/year2/${module.id}`} className="w-full">
                      <Button variant="outline" className="w-full border-white/10 hover:bg-white/5">
                        Détails
                      </Button>
                    </Link>
                    {module.price > 0 ? (
                      <Button 
                        className="w-full bg-[#D4AF37] text-black hover:bg-[#b5952f]"
                        onClick={() => handleAddToCart(module)}
                      >
                        Ajouter
                      </Button>
                    ) : (
                      <Button className="w-full bg-white/10 text-gray-400 cursor-not-allowed" disabled>
                        Réservé
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA Section - 3ème Année */}
        <div className="mt-12 relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 via-[#1a237e] to-purple-900 border border-white/10 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#D4AF37]/10 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none"></div>
          
          <div className="relative z-10 p-10 md:p-14 flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-blue-100 mb-6 backdrop-blur-sm">
              <Star className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-sm font-bold tracking-widest uppercase">Vers la Maîtrise Ultime</span>
            </div>
            
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mb-6">
              Prochaine Étape : <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#F2D06B]">3ème Année</span>
            </h2>
            
            <p className="text-xl text-blue-100 max-w-3xl mb-10 leading-relaxed">
              Vous avez exploré les fondements et perfectionné votre technique. 
              La 3ème année vous ouvre les portes de la haute initiation et de la transmission.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 w-full max-w-5xl">
              {[
                { text: "Approfondir la pratique rituelle", icon: Zap },
                { text: "Développer l'art de la transmission", icon: BookOpen },
                { text: "Intervenir sur les plans subtils", icon: Star },
                { text: "Contribuer à l'égrégore mondial", icon: Globe }
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all">
                  <item.icon className="w-8 h-8 text-[#D4AF37] mb-3" />
                  <span className="font-medium text-blue-50">{item.text}</span>
                </div>
              ))}
            </div>

            <Link to="/year3-modules">
              <Button className="bg-[#D4AF37] text-black hover:bg-white hover:text-black font-bold text-lg px-10 py-6 rounded-full shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] transition-all transform hover:-translate-y-1">
                Accéder à la 3ème Année <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ModuleCatalogPage;