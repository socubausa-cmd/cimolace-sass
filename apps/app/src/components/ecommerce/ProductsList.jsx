import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProducts, formatCurrency } from '@/api/EcommerceApi';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShoppingCart, Star, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const ProductsList = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addToCart } = useCart();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const data = await getProducts({ limit: 50 });
        setProducts(data.products || []);
      } catch (err) {
        console.error("Failed to load products:", err);
        setError("Impossible de charger les produits pour le moment.");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--school-accent)]" />
        <span className="ml-2 text-gray-400">Chargement des produits...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-red-400">
        <p>{error}</p>
        <Button 
          variant="outline" 
          onClick={() => window.location.reload()} 
          className="mt-4 border-red-500/30 hover:bg-red-500/10"
        >
          Réessayer
        </Button>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>Aucun produit disponible pour le moment.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map((product) => (
        <Card key={product.id} className="bg-[#192734] border-white/10 overflow-hidden flex flex-col h-full hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-all duration-300">
          <div className="relative aspect-square overflow-hidden bg-white/5 group">
            <img 
              src={product.image || '/placeholder-product.jpg'} 
              alt={product.title}
              className="object-cover w-full h-full transform group-hover:scale-110 transition-transform duration-500"
            />
            {!product.purchasable && (
              <div className="absolute top-2 right-2">
                <Badge variant="destructive">Indisponible</Badge>
              </div>
            )}
            {product.ribbon_text && (
               <div className="absolute top-2 left-2">
                <Badge className="bg-[var(--school-accent)] text-black hover:bg-[#b5952f]">{product.ribbon_text}</Badge>
              </div>
            )}
          </div>

          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg font-serif text-white line-clamp-1" title={product.title}>
                  {product.title}
                </CardTitle>
                <div className="flex items-center mt-1 space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star 
                      key={star} 
                      className={`w-3 h-3 ${star <= 5 ? 'text-[var(--school-accent)] fill-[var(--school-accent)]' : 'text-gray-600'}`} 
                    />
                  ))}
                  <span className="text-sm text-gray-500 ml-1">(5.0)</span>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-grow">
            <div 
              className="text-sm text-gray-400 line-clamp-3 mb-4"
              dangerouslySetInnerHTML={{ __html: product.description }} 
            />
            <div className="text-xl font-bold text-[var(--school-accent)]">
              {formatCurrency(product.price_in_cents, { code: product.currency })}
            </div>
          </CardContent>

          <CardFooter className="gap-2 pt-0">
            <Link to={`/product/${product.id}`} className="flex-1">
              <Button variant="outline" className="w-full border-white/10 hover:bg-white/5 text-gray-300">
                <Eye className="w-4 h-4 mr-2" />
                Détails
              </Button>
            </Link>
            <Button 
              className="flex-1 bg-[var(--school-accent)] hover:bg-[#b5952f] text-black"
              disabled={!product.purchasable}
              onClick={() => addToCart(product)}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Ajouter
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};

export default ProductsList;