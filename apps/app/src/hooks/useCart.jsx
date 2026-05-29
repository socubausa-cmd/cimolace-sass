import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';

const CartContext = createContext();

function readProraCartFromStorage() {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('prora_cart');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => readProraCartFromStorage());
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Persist to localStorage
    localStorage.setItem('prora_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (product, quantity = 1, variantId = null) => {
    // Determine variant to use (either passed explicitly, or first available)
    const selectedVariant = variantId 
      ? product.variants.find(v => v.id === variantId) 
      : product.variants[0];

    if (!selectedVariant) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter ce produit (variante introuvable).",
        variant: "destructive"
      });
      return;
    }

    setCartItems(prev => {
      const existingItemIndex = prev.findIndex(item => item.variant_id === selectedVariant.id);
      
      if (existingItemIndex > -1) {
        // Update existing item
        const newItems = [...prev];
        newItems[existingItemIndex].quantity += quantity;
        
        toast({
          title: "Panier mis à jour",
          description: `${product.title} (+${quantity})`,
          variant: "default"
        });
        return newItems;
      } else {
        // Add new item
        const newItem = {
          id: product.id,
          variant_id: selectedVariant.id,
          title: product.title,
          price_in_cents: selectedVariant.price_in_cents,
          currency: selectedVariant.currency,
          image: selectedVariant.image_url || product.image || (product.images && product.images[0]?.url),
          quantity: quantity,
          max_stock: selectedVariant.manage_inventory ? selectedVariant.inventory_quantity : 99 // Fallback if no inventory tracking
        };
        
        toast({
          title: "Ajouté au panier",
          description: `${product.title} a été ajouté.`,
          variant: "default"
        });
        return [...prev, newItem];
      }
    });
    
    // Open cart to show feedback
    setIsCartOpen(true);
  };

  const removeFromCart = (variantId) => {
    setCartItems(prev => prev.filter(item => item.variant_id !== variantId));
  };

  const updateQuantity = (variantId, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(variantId);
      return;
    }
    
    setCartItems(prev => 
      prev.map(item => 
        item.variant_id === variantId 
          ? { ...item, quantity: newQuantity } 
          : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + (item.price_in_cents * item.quantity), 0);
  };

  const getCartCount = () => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  };

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);
  const toggleCart = () => setIsCartOpen(prev => !prev);

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getCartTotal,
      getCartCount,
      isCartOpen,
      openCart,
      closeCart,
      toggleCart
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};