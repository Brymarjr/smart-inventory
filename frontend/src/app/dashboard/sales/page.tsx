'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks'; // ✅ NEW
import { db } from '@/lib/db'; // ✅ NEW
import { useSync } from '@/hooks/use-sync'; // ✅ NEW
import { useReactToPrint } from 'react-to-print';
import api from '@/lib/api';
import { Product, CartItem } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
    Search, PackageOpen, LayoutGrid, List, Printer, CheckCircle2, 
    History, ShoppingBag, Wifi, WifiOff, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { PosCart } from './pos-cart';
import { ReceiptTemplate } from '@/components/sales/receipt-template';

export default function SalesPage() {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos');
  
  // ✅ Offline & Sync State
  const { isSyncing, pendingCount } = useSync();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
        setIsOnline(navigator.onLine);
        window.addEventListener('online', () => setIsOnline(true));
        window.addEventListener('offline', () => setIsOnline(false));
    }
  }, []);

  // --- PRINTING STATE ---
  const [selectedSale, setSelectedSale] = useState<any>(null); 
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
      contentRef: printRef,
  });

  // 1. Fetch Store Settings (Usually cached, fine to keep)
  const { data: settings } = useQuery({
      queryKey: ['settings'],
      queryFn: async () => (await api.get('/api/settings/')).data,
      staleTime: Infinity
  });

  // ✅ 2. LIVE QUERY: Products from Local DB
  // This replaces the API call. It's instant and works offline.
  const localProducts = useLiveQuery(
    () => {
      // Basic search logic
      if (!search) return db.products.toArray();
      
      return db.products
        .filter(p => 
            p.name.toLowerCase().includes(search.toLowerCase()) || 
            p.sku.toLowerCase().includes(search.toLowerCase())
        )
        .toArray();
    },
    [search]
  );

  // 3. Fetch Sales History (Keep this online-only for now, or sync it too if needed)
  const { data: salesHistory, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['sales', search], 
    queryFn: async () => {
       const params = { search }; 
       const { data } = await api.get('/api/sales/', { params });
       return data;
    },
    enabled: activeTab === 'history' 
  });

  // --- HANDLERS ---
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
  };

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
          productId: product.id, 
          name: product.name, 
          price: parseFloat(product.price as any),
          quantity: 1, 
          maxStock: product.quantity,
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
      
      {/* LEFT SIDE: MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Header & Toggles */}
        <div className="flex items-center justify-between mb-4 gap-4 shrink-0">
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

            {/* Status Badges (Sync & Online) */}
            <div className="flex items-center gap-2">
                {isSyncing ? (
                    <Badge variant="secondary" className="gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Syncing...
                    </Badge>
                ) : pendingCount > 0 ? (
                    <Badge variant="destructive">
                        {pendingCount} Pending
                    </Badge>
                ) : null}

                {/* ✅ FIX: Wrap icons in a div/span to use the 'title' tooltip */}
                {isOnline ? (
                    <span title="Online">
                        <Wifi className="text-green-500 h-5 w-5" />
                    </span>
                ) : (
                    <span title="Offline">
                        <WifiOff className="text-red-500 h-5 w-5" />
                    </span>
                )}
            </div>

            <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder={activeTab === 'pos' ? "Search products..." : "Search receipt #..."}
                    className="pl-8" 
                    value={search}
                    onChange={handleSearch}
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

        {/* --- MAIN DISPLAY AREA --- */}
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-lg border shadow-sm overflow-hidden">
            
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                
                {/* VIEW 1: POS PRODUCT GRID (LOCAL) */}
                {activeTab === 'pos' && (
                    <>
                    {!localProducts ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
                        </div>
                    ) : localProducts.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                            <PackageOpen className="h-12 w-12 mb-2 opacity-20" />
                            <p>No products found locally.</p>
                            <p className="text-xs">Try syncing if you expect items.</p>
                        </div>
                    ) : (
                        <div className={viewMode === 'grid' ? "grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "space-y-2"}>
                            {localProducts.map((product) => {
                                const inCart = cart.find(c => c.productId === product.id)?.quantity || 0;
                                const remaining = product.quantity - inCart;
                                const isOutOfStock = remaining <= 0;

                                return (
                                   <Card 
                                     key={product.id} 
                                     className={`cursor-pointer transition-all hover:border-primary/50 hover:shadow-md active:scale-95 ${
                                         isOutOfStock ? 'opacity-50 grayscale cursor-not-allowed' : ''
                                     }`}
                                     onClick={() => !isOutOfStock && addToCart(product as any)}
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

                {/* VIEW 2: SALES HISTORY TABLE (Keep this Online for now) */}
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
                                            <TableCell className="font-mono text-xs">{sale.reference}</TableCell>
                                            <TableCell>{format(new Date(sale.created_at), "MMM d, HH:mm")}</TableCell>
                                            <TableCell>{sale.customer_name || 'Walk-in'}</TableCell>
                                            <TableCell className="font-bold">₦{Number(sale.total_amount).toLocaleString()}</TableCell>
                                            <TableCell className="text-right">
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
      </div>

      {/* RIGHT SIDE: CART */}
      {activeTab === 'pos' && (
          <div className="w-full md:w-[400px] shrink-0 h-[500px] md:h-auto">
            <PosCart 
                cart={cart}
                onRemove={removeFromCart}
                onUpdateQty={updateQuantity}
                onClear={() => setCart([])}
                onSaleSuccess={(saleData) => {
                    setSelectedSale(saleData); 
                    setCart([]); 
                }}
            />
          </div>
      )}

      {/* --- RECEIPT DIALOG --- */}
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