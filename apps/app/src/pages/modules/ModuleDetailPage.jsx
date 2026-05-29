import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator'; // Need to create ui/separator or use hr
import { Clock, BookOpen, CheckCircle, AlertCircle, ChevronDown, ChevronUp, ShoppingCart } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const ModuleDetailPageY2 = () => {
  const { moduleId } = useParams();
  const [module, setModule] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [expandedWeek, setExpandedWeek] = useState(null);

  useEffect(() => {
    fetchModuleDetails();
  }, [moduleId]);

  const fetchModuleDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('modules_year2')
        .select('*')
        .eq('id', moduleId)
        .single();
      
      if (error) throw error;
      setModule(data);
    } catch (error) {
      console.error('Error:', error);
      toast({ title: "Erreur", description: "Module introuvable", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    const currentCart = JSON.parse(localStorage.getItem('moduleCart') || '[]');
    if (currentCart.find(item => item.id === module.id)) {
      toast({ title: "Info", description: "Déjà dans le panier." });
      return;
    }
    const newCart = [...currentCart, module];
    localStorage.setItem('moduleCart', JSON.stringify(newCart));
    toast({ title: "Succès", description: "Ajouté au panier." });
  };

  if (loading) return <div className="min-h-screen pt-24 text-center text-white">Chargement...</div>;
  if (!module) return <div className="min-h-screen pt-24 text-center text-white">Module non trouvé</div>;

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-20">
      <Helmet><title>{`${module.title} | ${isnaTenantConfig.branding.name}`}</title></Helmet>

      {/* Header */}
      <div className="bg-[#192734] border-b border-white/5 py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-4 items-center mb-4">
            <Badge variant="outline" className="border-[#D4AF37] text-[#D4AF37] uppercase">{module.type}</Badge>
            <span className="text-gray-400 font-mono text-sm">{module.code}</span>
          </div>
          <h1 className="text-4xl font-serif font-bold mb-6">{module.title}</h1>
          <p className="text-xl text-gray-300 mb-8 leading-relaxed">{module.description}</p>
          
          <div className="flex flex-wrap gap-8 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#D4AF37]" />
              <span className="text-gray-300">{module.duration_weeks} Semaines ({module.duration_hours}h)</span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#D4AF37]" />
              <span className="text-gray-300">{module.access_level?.join(', ')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-12">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-12">
          
          {/* Objectives */}
          <section>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-[#D4AF37]" /> Objectifs Pédagogiques
            </h2>
            <ul className="space-y-3">
              {module.learning_objectives?.map((obj, i) => (
                <li key={i} className="flex gap-3 text-gray-300">
                  <span className="block w-1.5 h-1.5 rounded-full bg-[#D4AF37] mt-2.5 shrink-0"></span>
                  {obj}
                </li>
              ))}
            </ul>
          </section>

          {/* Content Outline */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Programme Détaillé</h2>
            <div className="space-y-4">
              {[...Array(module.duration_weeks)].map((_, i) => (
                <div key={i} className="border border-white/10 rounded-xl bg-[#192734] overflow-hidden">
                  <button 
                    onClick={() => setExpandedWeek(expandedWeek === i ? null : i)}
                    className="w-full px-6 py-4 flex justify-between items-center hover:bg-white/5 transition-colors"
                  >
                    <span className="font-bold">Semaine {i + 1}</span>
                    {expandedWeek === i ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {expandedWeek === i && (
                    <div className="px-6 py-4 border-t border-white/5 text-gray-400 text-sm">
                      <p>Contenu détaillé du module pour cette semaine...</p>
                      {/* Would normally fetch module_content_y2 here */}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* Sidebar Actions */}
        <div className="md:col-span-1">
          <div className="bg-[#192734] border border-white/10 rounded-xl p-6 sticky top-24">
            <div className="text-3xl font-bold text-white mb-2">
              {module.price > 0 ? `${module.price}€` : 'Gratuit*'}
            </div>
            <div className="text-sm text-gray-500 mb-6 uppercase tracking-wide">
              {module.price > 0 ? 'Prix Public (Modulaire)' : '*Pour étudiants inscrits'}
            </div>

            <div className="space-y-3">
              {module.price > 0 && (
                <Button onClick={handleAddToCart} className="w-full bg-[#D4AF37] text-black hover:bg-[#b5952f] font-bold">
                  <ShoppingCart className="w-4 h-4 mr-2" /> Ajouter au Panier
                </Button>
              )}
              
              <Link to="/formations/inscription">
                <Button variant="outline" className="w-full border-white/10 text-white hover:bg-white/5">
                  S'inscrire (Cycle Complet)
                </Button>
              </Link>

              {module.type === 'nocturne' && (
                <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-xs text-purple-300 flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Ce module nécessite une validation préalable.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModuleDetailPageY2;