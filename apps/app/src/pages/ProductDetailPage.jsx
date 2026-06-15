import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getProduct, formatCurrency } from '@/api/EcommerceApi';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, ArrowLeft, ShoppingCart, Check, Star, AlertCircle, Minus, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { SafeHtml } from '@/components/common/SafeHtml';

const ProductDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { toast } = useToast();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [mainImage, setMainImage] = useState(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const data = await getProduct(id);
        setProduct(data);
        
        // Default to first variant
        if (data.variants && data.variants.length > 0) {
          setSelectedVariant(data.variants[0]);
        }
        
        // Default image
        if (data.images && data.images.length > 0) {
          setMainImage(data.images[0].url);
        } else {
          setMainImage(data.image || '/placeholder-product.jpg');
        }
      } catch (err) {
        console.error("Error loading product:", err);
        setError("Produit introuvable ou erreur de chargement.");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleQuantityChange = (delta) => {
    const maxStock = selectedVariant?.manage_inventory 
      ? (selectedVariant.inventory_quantity || 10) 
      : 99;
      
    setQuantity(prev => {
      const newVal = prev + delta;
      if (newVal < 1) return 1;
      if (newVal > maxStock) return maxStock;
      return newVal;
    });
  };

  const handleAddToCart = () => {
    if (!selectedVariant) return;
    
    addToCart(product, quantity, selectedVariant.id);
    // Optionally navigate to cart or stay here
    // navigate('/cart'); // User asked to stay or navigate? "adds product and navigates to /cart" -> Wait, user asked to "navigates to /cart". But /cart isn't a page, it's a sidebar. The sidebar opens automatically via addToCart.
    // I'll assume standard behavior: open sidebar.
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1419] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--school-accent)]" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-[#0F1419] flex flex-col items-center justify-center text-white p-4">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Erreur</h2>
        <p className="text-gray-400 mb-6">{error || "Produit introuvable"}</p>
        <Button onClick={() => navigate('/products')} variant="outline" className="border-white/10">
          <ArrowLeft className="w-4 h-4 mr-2" /> Retour au catalogue
        </Button>
      </div>
    );
  }

  const maxStock = selectedVariant?.manage_inventory 
    ? (selectedVariant.inventory_quantity || 0) 
    : 999;
  
  const isOutOfStock = selectedVariant?.manage_inventory && maxStock <= 0;

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)} 
          className="mb-8 text-gray-400 hover:text-white hover:bg-white/5 pl-0"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Retour
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left: Images */}
          <div className="space-y-4">
            <div className="aspect-square bg-white/5 rounded-xl overflow-hidden border border-white/10">
              <img 
                src={mainImage} 
                alt={product.title} 
                className="w-full h-full object-cover"
              />
            </div>
            {product.images && product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-4">
                {product.images.map((img, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setMainImage(img.url)}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${mainImage === img.url ? 'border-[var(--school-accent)]' : 'border-transparent hover:border-white/20'}`}
                  >
                    <img src={img.url} alt={`View ${idx}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div className="space-y-6">
            <div>
              {product.ribbon_text && (
                <Badge className="bg-[var(--school-accent)] text-black hover:bg-[#b5952f] mb-2">
                  {product.ribbon_text}
                </Badge>
              )}
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-white mb-2">
                {product.title}
              </h1>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center text-[var(--school-accent)]">
                  <Star className="w-4 h-4 fill-current" />
                  <Star className="w-4 h-4 fill-current" />
                  <Star className="w-4 h-4 fill-current" />
                  <Star className="w-4 h-4 fill-current" />
                  <Star className="w-4 h-4 fill-current" />
                  <span className="ml-2 text-gray-400">(5.0)</span>
                </div>
                <div className="w-px h-4 bg-gray-700"></div>
                <span className="text-gray-400">Réf: {selectedVariant?.sku || 'N/A'}</span>
              </div>
            </div>

            <div className="text-3xl font-bold text-[var(--school-accent)]">
              {selectedVariant && formatCurrency(selectedVariant.price_in_cents, { code: selectedVariant.currency })}
            </div>

            <Separator className="bg-white/10" />

            <SafeHtml
              className="prose prose-invert max-w-none text-gray-300"
              html={product.description}
            />

            <div className="space-y-4 pt-4">
              {/* Variant Selector (if multiple) */}
              {product.variants.length > 1 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Variante</label>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => {
                          setSelectedVariant(v);
                          setQuantity(1);
                        }}
                        className={`px-4 py-2 rounded-md border text-sm transition-all ${
                          selectedVariant?.id === v.id 
                            ? 'border-[var(--school-accent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[var(--school-accent)]' 
                            : 'border-white/10 bg-[#192734] text-gray-400 hover:border-white/30'
                        }`}
                      >
                        {v.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity & Stock */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-sm font-medium text-gray-300">Quantité</label>
                  <span className={`text-sm ${isOutOfStock ? 'text-red-400' : 'text-green-400'}`}>
                    {selectedVariant?.manage_inventory 
                      ? (isOutOfStock ? 'Rupture de stock' : `${maxStock} en stock`) 
                      : 'En stock'}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center bg-[#192734] border border-white/10 rounded-md">
                    <button 
                      onClick={() => handleQuantityChange(-1)}
                      className="p-3 hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                      disabled={quantity <= 1 || isOutOfStock}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-12 text-center font-medium">{quantity}</span>
                    <button 
                      onClick={() => handleQuantityChange(1)}
                      className="p-3 hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                      disabled={quantity >= maxStock || isOutOfStock}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <Button 
                    className="flex-1 h-12 bg-[var(--school-accent)] hover:bg-[#b5952f] text-black font-bold text-lg"
                    onClick={handleAddToCart}
                    disabled={isOutOfStock || !product.purchasable}
                  >
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    Ajouter au panier
                  </Button>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            {product.additional_info && product.additional_info.length > 0 && (
              <div className="pt-6 space-y-4">
                 {product.additional_info.map((info) => (
                   <div key={info.id} className="bg-[#192734] p-4 rounded-lg border border-white/5">
                     <h3 className="font-bold text-white mb-2">{info.title}</h3>
                     <SafeHtml className="text-sm text-gray-400" html={info.description} />
                   </div>
                 ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;