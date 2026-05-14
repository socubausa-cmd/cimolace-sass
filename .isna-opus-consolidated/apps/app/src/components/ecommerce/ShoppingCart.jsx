import React, { useState } from 'react';
import { useCart } from '@/hooks/useCart';
import { initializeCheckout, formatCurrency } from '@/api/EcommerceApi';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Loader2, Trash2, ShoppingBag, Plus, Minus, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getCheckoutSuccessPath } from '@/lib/eleveBillingPath';
import { AnimatePresence, motion } from 'framer-motion';

const ShoppingCart = () => {
  const { 
    cartItems, 
    removeFromCart, 
    updateQuantity, 
    clearCart, 
    getCartTotal, 
    isCartOpen, 
    closeCart 
  } = useCart();
  
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const { toast } = useToast();

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;

    setIsCheckingOut(true);
    try {
      const items = cartItems.map(item => ({
        variant_id: item.variant_id,
        quantity: item.quantity
      }));

      const successUrl = `${window.location.origin}${getCheckoutSuccessPath()}`;
      const cancelUrl = window.location.href; // Return to current page

      const { url } = await initializeCheckout({
        items,
        successUrl,
        cancelUrl,
        locale: 'fr'
      });

      // Redirect to checkout
      window.location.href = url;
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        title: "Erreur de paiement",
        description: "Impossible d'initialiser le paiement. Veuillez réessayer.",
        variant: "destructive"
      });
      setIsCheckingOut(false);
    }
  };

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={closeCart}
      />

      {/* Sidebar Panel */}
      <motion.div 
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative w-full max-w-md bg-[#0F1419] h-full shadow-2xl border-l border-white/10 flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-serif font-bold text-white flex items-center">
            <ShoppingBag className="w-5 h-5 mr-2 text-[#D4AF37]" />
            Votre Panier ({cartItems.reduce((a,c) => a + c.quantity, 0)})
          </h2>
          <button 
            onClick={closeCart}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
              <ShoppingBag className="w-16 h-16 opacity-20" />
              <p>Votre panier est vide</p>
              <Button onClick={closeCart} variant="outline" className="border-white/10">
                Continuer mes achats
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {cartItems.map((item) => (
                <div key={item.variant_id} className="flex gap-4">
                  <div className="w-20 h-20 bg-white/5 rounded-md overflow-hidden flex-shrink-0 border border-white/5">
                    <img 
                      src={item.image || '/placeholder-product.jpg'} 
                      alt={item.title} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-medium text-white line-clamp-2 text-sm">{item.title}</h3>
                      <p className="text-[#D4AF37] font-semibold mt-1">
                        {formatCurrency(item.price_in_cents, { code: item.currency })}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center bg-[#192734] rounded border border-white/10">
                        <button 
                          onClick={() => updateQuantity(item.variant_id, item.quantity - 1)}
                          className="p-1 px-2 hover:bg-white/5 text-gray-400 hover:text-white"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs w-8 text-center">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.variant_id, item.quantity + 1)}
                          className="p-1 px-2 hover:bg-white/5 text-gray-400 hover:text-white"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button 
                        onClick={() => removeFromCart(item.variant_id)}
                        className="text-gray-500 hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="p-6 bg-[#192734] border-t border-white/10 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-gray-400 text-sm">
                <span>Sous-total</span>
                <span>{formatCurrency(getCartTotal(), { code: cartItems[0]?.currency || 'EUR' })}</span>
              </div>
              <div className="flex justify-between text-white font-bold text-lg pt-2 border-t border-white/5">
                <span>Total</span>
                <span>{formatCurrency(getCartTotal(), { code: cartItems[0]?.currency || 'EUR' })}</span>
              </div>
            </div>
            
            <Button 
              className="w-full bg-[#D4AF37] hover:bg-[#b5952f] text-black font-bold h-12"
              onClick={handleCheckout}
              disabled={isCheckingOut}
            >
              {isCheckingOut ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Traitement...
                </>
              ) : (
                "Passer la commande"
              )}
            </Button>
            
            <Button 
              variant="ghost" 
              className="w-full text-gray-500 hover:text-red-400 hover:bg-transparent"
              onClick={clearCart}
            >
              Vider le panier
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ShoppingCart;