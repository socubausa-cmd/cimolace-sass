import React from 'react';
import ProductsList from '@/components/ecommerce/ProductsList';
import { Package } from 'lucide-react';

const ProductsPage = () => {
  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <Package className="w-16 h-16 text-[var(--school-accent)] mx-auto opacity-80" />
          <h1 className="text-4xl md:text-5xl font-serif font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
            Nos Produits
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Découvrez notre sélection exclusive de formations, ouvrages et ressources pour votre développement spirituel et intellectuel.
          </p>
          <div className="w-24 h-1 bg-[var(--school-accent)] mx-auto rounded-full mt-4"></div>
        </div>

        <div className="mt-12">
          <ProductsList />
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;