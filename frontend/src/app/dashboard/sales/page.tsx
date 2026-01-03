'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Product, PaginatedResponse, CartItem } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, PackageOpen, LayoutGrid, List } from 'lucide-react';
import { PosCart } from './pos-cart';
import { Button } from '@/components/ui/button';

export default function SalesPage() {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Fetch Products for POS
  const { data, isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn: async () => {
      const params = { search, page_size: 50 }; // Fetch more items for POS
      const { data } = await api.get<PaginatedResponse<Product>>('/api/products/', { params });
      return data;
    },
  });

  // --- CART LOGIC ---
  const addToCart = (product: Product) => {
    if (product.quantity <= 0) return; // Prevent adding out-of-stock items

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        // Increment quantity if not hitting max stock
        if (existing.quantity < product.quantity) {
             return prev.map((item) =>
                item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
             );
        }
        return prev;
      }
      // Add new item
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: parseFloat(product.price as unknown as string), // Ensure number
          quantity: 1,
          maxStock: product.quantity,
        },
      ];
    });
  };

  const removeFromCart = (id: number) => {
    setCart((prev) => prev.filter((item) => item.productId !== id));
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) => prev.map((item) => {
        if (item.productId === id) {
            const newQty = item.quantity + delta;
            // Bound between 1 and maxStock
            if (newQty > 0 && newQty <= item.maxStock) {
                return { ...item, quantity: newQty };
            }
        }
        return item;
    }));
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col md:flex-row gap-4">
      
      {/* LEFT SIDE: PRODUCT CATALOG */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-4 gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search products by name or SKU..." 
                    className="pl-8" 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                />
            </div>
            <div className="flex gap-1 border rounded-md p-1 bg-white">
                <Button 
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => setViewMode('grid')}
                >
                    <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button 
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => setViewMode('list')}
                >
                    <List className="h-4 w-4" />
                </Button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
            {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-lg" />)}
                </div>
            ) : data?.results.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <PackageOpen className="h-12 w-12 mb-2 opacity-20" />
                    <p>No products found</p>
                </div>
            ) : (
                <div className={viewMode === 'grid' 
                    ? "grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" 
                    : "space-y-2"
                }>
                    {data?.results.map((product) => {
                        const inCart = cart.find(c => c.productId === product.id)?.quantity || 0;
                        const remaining = product.quantity - inCart;
                        const isOutOfStock = remaining <= 0;

                        return (
                           <Card 
                             key={product.id} 
                             className={`cursor-pointer transition-all hover:border-primary/50 hover:shadow-md active:scale-95 ${
                                isOutOfStock ? 'opacity-50 grayscale cursor-not-allowed' : ''
                             }`}
                             onClick={() => !isOutOfStock && addToCart(product)}
                           >
                             <CardContent className={viewMode === 'grid' ? "p-4 flex flex-col h-full" : "p-3 flex items-center justify-between"}>
                                <div className={viewMode === 'grid' ? "flex-1" : ""}>
                                    <h3 className="font-semibold text-sm line-clamp-2 leading-tight mb-1">{product.name}</h3>
                                    <p className="text-xs text-muted-foreground mb-2">{product.sku}</p>
                                </div>
                                
                                <div className={viewMode === 'grid' ? "flex items-center justify-between mt-auto pt-2 border-t" : "text-right flex items-center gap-6"}>
                                    <Badge variant={isOutOfStock ? "destructive" : "secondary"} className="text-[10px] px-1.5 h-5">
                                        {isOutOfStock ? 'Out' : `${remaining} Left`}
                                    </Badge>
                                    <span className="font-bold text-primary">₦{parseFloat(product.price as any).toLocaleString()}</span>
                                </div>
                             </CardContent>
                           </Card>
                        );
                    })}
                </div>
            )}
        </div>
      </div>

      {/* RIGHT SIDE: CART */}
      <div className="w-full md:w-[400px] shrink-0 h-[500px] md:h-auto">
        <PosCart 
            cart={cart}
            onRemove={removeFromCart}
            onUpdateQty={updateQuantity}
            onClear={() => setCart([])}
        />
      </div>

    </div>
  );
}