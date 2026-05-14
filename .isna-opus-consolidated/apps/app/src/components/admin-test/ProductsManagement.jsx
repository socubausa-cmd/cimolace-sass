import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Edit, Trash2, Package } from 'lucide-react';

const ProductsManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const products = [
    { id: 1, name: 'Premium Wireless Headphones', category: 'Electronics', price: '$299.00', stock: 45, status: 'In Stock' },
    { id: 2, name: 'Ergonomic Office Chair', category: 'Furniture', price: '$189.99', stock: 12, status: 'Low Stock' },
    { id: 3, name: 'Mechanical Keyboard RGB', category: 'Electronics', price: '$129.50', stock: 0, status: 'Out of Stock' },
    { id: 4, name: '4K Ultra HD Monitor', category: 'Electronics', price: '$349.00', stock: 28, status: 'In Stock' },
    { id: 5, name: 'Leather Desk Mat', category: 'Accessories', price: '$39.99', stock: 150, status: 'In Stock' },
    { id: 6, name: 'USB-C Docking Station', category: 'Electronics', price: '$89.99', stock: 34, status: 'In Stock' },
  ];

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <Card className="border-none shadow-lg bg-[#192734]">
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-white">Products Inventory</CardTitle>
          <CardDescription className="text-gray-400">Manage your product catalog</CardDescription>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input 
              placeholder="Search products..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-[#0F1419] border-white/10 text-white focus:ring-blue-500"
            />
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> Add Product
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-blue-500/50 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-blue-900/20 rounded-lg text-blue-400">
                  <Package className="w-6 h-6" />
                </div>
                <Badge variant="outline" className={`${
                  product.status === 'In Stock' ? 'text-green-400 border-green-400/30' : 
                  product.status === 'Low Stock' ? 'text-yellow-400 border-yellow-400/30' : 
                  'text-red-400 border-red-400/30'
                }`}>
                  {product.status}
                </Badge>
              </div>
              <h3 className="text-lg font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">{product.name}</h3>
              <p className="text-sm text-gray-400 mb-4">{product.category}</p>
              
              <div className="flex items-center justify-between mt-auto">
                <span className="text-xl font-bold text-white">{product.price}</span>
                <span className="text-sm text-gray-500">{product.stock} units</span>
              </div>
              
              <div className="mt-4 pt-4 border-t border-white/10 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 border-white/10 text-gray-300 hover:text-white">
                  <Edit className="w-3 h-3 mr-2" /> Edit
                </Button>
                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-900/20">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductsManagement;