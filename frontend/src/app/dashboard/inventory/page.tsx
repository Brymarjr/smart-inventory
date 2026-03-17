'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Product, PaginatedResponse } from '@/lib/types';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"; 
import { 
  Plus, AlertTriangle, PackageOpen, Settings2, Trash2, 
  ArchiveRestore, RotateCcw, ChevronLeft, ChevronRight, Loader2, Edit2
} from 'lucide-react';
import { ProductForm } from './product-form';
import { StockAdjustmentDialog } from '@/components/inventory/stock-adjustment-dialog';
import { ArchiveProductDialog } from '@/components/inventory/archive-product-dialog'; 
import { RestoreProductDialog } from '@/components/inventory/restore-product-dialog';
import { EditProductDialog } from '@/components/inventory/edit-product-dialog';

// ✅ Import the new component
import { DebouncedInput } from '@/components/shared/debounced-input';

export default function InventoryPage() {
  // ✅ We only hold the "Final" search term here. 
  // The immediate typing is handled inside DebouncedInput.
  const [search, setSearch] = useState(''); 
  
  const [page, setPage] = useState(1);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState("active");

  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [archiveProduct, setArchiveProduct] = useState<Product | null>(null);
  const [restoreProduct, setRestoreProduct] = useState<Product | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    setPage(1);
  }, [search, currentTab]);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['products', search, currentTab, page],
    queryFn: async () => {
      const params: any = { page, page_size: 20 };
      if (search) params.search = search;
      if (currentTab === 'archived') params.deleted = 'true';
      
      const response = await api.get<PaginatedResponse<Product>>('/api/products/', { params });
      return response.data;
    },
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Manage your stock levels and catalog.</p>
        </div>
        
        {currentTab === 'active' && (
            <Button onClick={() => setIsAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Product
            </Button>
        )}
      </div>

      <Tabs defaultValue="active" onValueChange={setCurrentTab} className="w-full">
        <div className="flex items-center justify-between mb-4">
            <TabsList>
                <TabsTrigger value="active">Active Inventory</TabsTrigger>
                <TabsTrigger value="archived" className="flex items-center gap-2">
                    <ArchiveRestore className="h-4 w-4" /> Archived
                </TabsTrigger>
            </TabsList>
        </div>

        <Card>
            <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
                <CardTitle>{currentTab === 'active' ? 'Active Products' : 'Archived Products'}</CardTitle>
                
                {/* ✅ FAST INPUT: Only updates parent state after 500ms delay */}
                <DebouncedInput 
                    value={search}
                    onChange={(val) => setSearch(val)}
                    isLoading={isFetching && !isLoading}
                    placeholder="Search products..."
                />

            </div>
            </CardHeader>
            <CardContent>
            {isLoading ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading inventory...
                </div>
            ) : isError ? (
                <div className="h-48 flex items-center justify-center text-red-500">
                Failed to load products.
                </div>
            ) : data?.results?.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
                <PackageOpen className="h-10 w-10 mb-2 opacity-20" />
                <p>No products found.</p>
                </div>
            ) : (
                <>
                <div className="rounded-md border">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Product ID</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-center">Stock</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {data?.results?.map((product) => (
                        <TableRow key={product.id} className={currentTab === 'archived' ? 'opacity-70 bg-gray-50' : ''}>
                        <TableCell className="font-medium">
                            {product.name}
                            {currentTab === 'active' && product.quantity <= product.reorder_level && (
                            <span className="ml-2 inline-flex items-center text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                <AlertTriangle className="w-3 h-3 mr-1" /> Low
                            </span>
                            )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{product.sku}</TableCell>
                        <TableCell>{product.category?.name || '-'}</TableCell>
                        <TableCell className="text-right">₦{parseFloat(product.price).toLocaleString()}</TableCell>
                        
                        <TableCell className="text-center">
                            <Badge variant={product.quantity > 0 ? "outline" : "destructive"}>
                            {product.quantity}
                            </Badge>
                        </TableCell>

                        <TableCell>
                           {currentTab === 'active' ? (
                                <Badge className={product.quantity > 0 ? "bg-green-600 text-white" : "bg-gray-500 text-white"}>
                                    {product.quantity > 0 ? 'In Stock' : 'Out of Stock'}
                                </Badge>
                           ) : (
                                <Badge variant="secondary">Archived</Badge>
                           )}
                        </TableCell>

                        <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                            {currentTab === 'active' ? (
                                <>
                                    <Button 
                                        variant="ghost" size="icon" title="Edit Product"
                                        onClick={() => setEditProduct(product)}
                                    >
                                        <Edit2 className="h-4 w-4 text-emerald-600" />
                                    </Button>

                                    <Button 
                                        variant="ghost" size="icon" title="Adjust Stock"
                                        onClick={() => setAdjustProduct(product)}
                                    >
                                        <Settings2 className="h-4 w-4 text-blue-600" />
                                    </Button>

                                    <Button 
                                        variant="ghost" size="icon" title="Archive Product"
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                        onClick={() => setArchiveProduct(product)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </>
                            ) : (
                                <Button 
                                    variant="ghost" size="sm" 
                                    onClick={() => setRestoreProduct(product)}
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                    <RotateCcw className="h-4 w-4 mr-1" />
                                    Restore
                                </Button>
                            )}
                            </div>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </div>

                <div className="flex items-center justify-between space-x-2 py-4">
                    <div className="text-sm text-muted-foreground">
                        {data?.count ? (
                            <span>
                                Showing <strong>{(page - 1) * 20 + 1}</strong> to <strong>{Math.min(page * 20, data.count)}</strong> of <strong>{data.count}</strong> results
                            </span>
                        ) : "0 results"}
                    </div>
                    <div className="space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(old => Math.max(old - 1, 1))}
                            disabled={page === 1 || isLoading}
                        >
                            <ChevronLeft className="h-4 w-4 mr-2" />
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(old => old + 1)}
                            disabled={!data?.next || isLoading}
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                </div>
                </>
            )}
            </CardContent>
        </Card>
      </Tabs>

      <ProductForm isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
      
      <StockAdjustmentDialog 
        product={adjustProduct as any} 
        isOpen={!!adjustProduct}
        onClose={() => setAdjustProduct(null)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['products'] })}
      />

      <ArchiveProductDialog 
        product={archiveProduct as any}
        isOpen={!!archiveProduct}
        onClose={() => setArchiveProduct(null)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['products'] })}
      />

      <RestoreProductDialog
        product={restoreProduct as any}
        isOpen={!!restoreProduct}
        onClose={() => setRestoreProduct(null)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['products'] })}
      />

      <EditProductDialog 
        product={editProduct} 
        open={!!editProduct} 
        onOpenChange={(open) => !open && setEditProduct(null)} 
      />
    </div>
  );
}