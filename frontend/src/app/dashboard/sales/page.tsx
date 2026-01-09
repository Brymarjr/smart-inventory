'use client';

import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import api from '@/lib/api';
import { Product, PaginatedResponse, CartItem } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, PackageOpen, LayoutGrid, List, Printer, CheckCircle2, History, ShoppingBag } from 'lucide-react';
import { format } from 'date-fns';
import { PosCart } from './pos-cart';
import { ReceiptTemplate } from '@/components/sales/receipt-template';

export default function SalesPage() {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos'); // ✅ Toggle between POS and History
  
  // --- PRINTING STATE ---
  // We call it 'selectedSale' now because it could be the LAST sale or a HISTORICAL sale
  const [selectedSale, setSelectedSale] = useState<any>(null); 
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
      contentRef: printRef,
  });

  // 1. Fetch Store Settings
  const { data: settings } = useQuery({
      queryKey: ['settings'],
      queryFn: async () => (await api.get('/api/settings/')).data,
      staleTime: Infinity
  });

  // 2. Fetch Products (For POS Tab)
  const { data: productsData, isLoading: isProductsLoading } = useQuery({
    queryKey: ['products', search],
    queryFn: async () => {
      const params = { search, page_size: 50 }; 
      const { data } = await api.get<PaginatedResponse<Product>>('/api/products/', { params });
      return data;
    },
    enabled: activeTab === 'pos' // Only fetch when in POS mode
  });

  // 3. Fetch Sales History (For History Tab)
  const { data: salesHistory, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['sales', search], 
    queryFn: async () => {
        // Pass the 'search' param to the backend
        const params = { search }; 
        const { data } = await api.get('/api/sales/', { params });
        return data;
    },
    enabled: activeTab === 'history' 
  });

  // --- CART HANDLERS ---
  const addToCart = (product: Product) => {
    if (product.quantity <= 0) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity < product.quantity) {
             return prev.map((item) =>
                item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
             );
        }
        return prev;
      }
      return [...prev, {
          productId: product.id, name: product.name, price: parseFloat(product.price as unknown as string),
          quantity: 1, maxStock: product.quantity,
      }];
    });
  };

  const removeFromCart = (id: number) => setCart((prev) => prev.filter((item) => item.productId !== id));

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) => prev.map((item) => {
        if (item.productId === id) {
            const newQty = item.quantity + delta;
            if (newQty > 0 && newQty <= item.maxStock) return { ...item, quantity: newQty };
        }
        return item;
    }));
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col md:flex-row gap-4">
      
      {/* LEFT SIDE: MAIN CONTENT (POS OR HISTORY) */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header & Toggles */}
        <div className="flex items-center justify-between mb-4 gap-4">
            <div className="flex gap-2">
                <Button 
                    variant={activeTab === 'pos' ? "default" : "outline"} 
                    onClick={() => setActiveTab('pos')}
                    className="gap-2"
                >
                    <ShoppingBag className="w-4 h-4" /> POS
                </Button>
                <Button 
                    variant={activeTab === 'history' ? "default" : "outline"} 
                    onClick={() => setActiveTab('history')}
                    className="gap-2"
                >
                    <History className="w-4 h-4" /> History
                </Button>
            </div>

            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder={activeTab === 'pos' ? "Search products..." : "Search receipt #..."}
                    className="pl-8" 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            
            {activeTab === 'pos' && (
                <div className="flex gap-1 border rounded-md p-1 bg-white">
                    <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('grid')}>
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('list')}>
                        <List className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>

        {/* --- CONTENT AREA --- */}
        <div className="flex-1 overflow-y-auto pr-2 bg-white rounded-lg border p-4 shadow-sm">
            
            {/* VIEW 1: POS PRODUCT GRID */}
            {activeTab === 'pos' && (
                <>
                {isProductsLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-lg" />)}
                    </div>
                ) : productsData?.results.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                        <PackageOpen className="h-12 w-12 mb-2 opacity-20" />
                        <p>No products found</p>
                    </div>
                ) : (
                    <div className={viewMode === 'grid' ? "grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "space-y-2"}>
                        {productsData?.results.map((product) => {
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
                </>
            )}

            {/* VIEW 2: SALES HISTORY TABLE */}
            {activeTab === 'history' && (
                <div className="h-full">
                    {isHistoryLoading ? (
                        <div className="space-y-2">
                             {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />)}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Receipt #</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {salesHistory?.results?.map((sale: any) => (
                                    <TableRow key={sale.id}>
                                        <TableCell className="font-mono text-xs">{sale.receipt_id || sale.id}</TableCell>
                                        <TableCell>{format(new Date(sale.created_at), "MMM d, HH:mm")}</TableCell>
                                        <TableCell>{sale.customer_name || 'Walk-in'}</TableCell>
                                        <TableCell className="font-bold">₦{Number(sale.total_amount).toLocaleString()}</TableCell>
                                        <TableCell className="text-right">
                                            {/* ✅ REPRINT BUTTON */}
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => setSelectedSale(sale)}
                                            >
                                                <Printer className="w-3 h-3 mr-1" /> Print
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            )}
        </div>
      </div>

      {/* RIGHT SIDE: CART (Only visible in POS Mode) */}
      {activeTab === 'pos' && (
          <div className="w-full md:w-[400px] shrink-0 h-[500px] md:h-auto">
            <PosCart 
                cart={cart}
                onRemove={removeFromCart}
                onUpdateQty={updateQuantity}
                onClear={() => setCart([])}
                // ✅ Handle successful sale from cart
                onSaleSuccess={(saleData) => {
                    setSelectedSale(saleData); 
                    setCart([]); 
                }}
            />
          </div>
      )}

      {/* --- RECEIPT DIALOG (Used by both POS success AND History Reprint) --- */}
      <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
        <DialogContent className="max-w-[400px]">
             <div className="flex flex-col items-center text-center p-4">
                <div className="h-12 w-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold mb-2">Receipt Ready</h2>
                <p className="text-muted-foreground mb-6">
                    Receipt #{selectedSale?.receipt_id || selectedSale?.id}
                </p>

                {/* HIDDEN RECEIPT COMPONENT (Rendered for printer only) */}
                <div className="hidden">
                    {selectedSale && settings && (
                        <ReceiptTemplate 
                           ref={printRef} 
                           sale={selectedSale} 
                           settings={settings} 
                        />
                    )}
                </div>

                <div className="flex flex-col w-full gap-3">
                    <Button onClick={() => handlePrint()} className="w-full" size="lg">
                        <Printer className="mr-2 h-4 w-4" /> Print Receipt
                    </Button>
                    <Button variant="outline" onClick={() => setSelectedSale(null)} className="w-full">
                        Close
                    </Button>
                </div>
             </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}