import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Trash2, CreditCard, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const ModuleCartPage = () => {
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const savedCart = JSON.parse(localStorage.getItem('moduleCart') || '[]');
    setCart(savedCart);
  }, []);

  const removeItem = (id) => {
    const newCart = cart.filter(item => item.id !== id);
    setCart(newCart);
    localStorage.setItem('moduleCart', JSON.stringify(newCart));
    toast({ title: "Retiré", description: "Module retiré du panier." });
  };

  const calculateTotal = () => {
    return cart.reduce((acc, item) => acc + (parseFloat(item.price) || 0), 0);
  };

  const handleCheckout = async () => {
    if (!user) {
      toast({ title: "Connexion requise", description: "Veuillez vous connecter pour payer." });
      // Redirect logic here if needed
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          modules: cart.map(i => ({ id: i.id, price: i.price })),
          studentId: user.id,
          email: user.email
        }
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast({ title: "Erreur", description: "Erreur lors de l'initialisation du paiement.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-20">
      <Helmet><title>Panier | PRORASCIENCE</title></Helmet>
      
      <div className="max-w-5xl mx-auto px-6">
        <h1 className="text-3xl font-serif font-bold mb-8">Votre Panier</h1>

        {cart.length === 0 ? (
          <div className="text-center py-20 bg-[#192734] rounded-2xl border border-white/5">
            <p className="text-gray-400 mb-6">Votre panier est vide.</p>
            <Link to="/modules/year2-catalog">
              <Button className="bg-[var(--school-accent)] text-black hover:bg-[#b5952f]">
                Parcourir le catalogue
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-12">
            <div className="md:col-span-2 space-y-4">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between items-center bg-[#192734] p-4 rounded-xl border border-white/5">
                  <div>
                    <h3 className="font-bold text-white">{item.title}</h3>
                    <p className="text-sm text-gray-400 font-mono">{item.code}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="font-bold text-[var(--school-accent)]">{item.price}€</span>
                    <button onClick={() => removeItem(item.id)} className="text-gray-500 hover:text-red-500 transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              
              <Link to="/modules/year2-catalog" className="inline-flex items-center text-sm text-gray-400 hover:text-white mt-4">
                <ArrowLeft className="w-4 h-4 mr-2" /> Continuer mes achats
              </Link>
            </div>

            <div className="bg-[#192734] border border-white/10 rounded-xl p-6 h-fit">
              <h3 className="text-lg font-bold mb-6">Récapitulatif</h3>
              <div className="flex justify-between mb-2 text-gray-400">
                <span>Sous-total</span>
                <span>{calculateTotal()}€</span>
              </div>
              <div className="flex justify-between mb-6 text-gray-400 text-sm">
                <span>Taxes (estimées)</span>
                <span>0€</span>
              </div>
              <div className="border-t border-white/10 pt-4 flex justify-between mb-8 font-bold text-xl">
                <span>Total</span>
                <span>{calculateTotal()}€</span>
              </div>
              
              <Button onClick={handleCheckout} disabled={loading} className="w-full bg-[var(--school-accent)] text-black hover:bg-[#b5952f] font-bold py-6">
                {loading ? 'Chargement...' : <><CreditCard className="w-5 h-5 mr-2" /> Payer</>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModuleCartPage;