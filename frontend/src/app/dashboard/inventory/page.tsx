'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Product, PaginatedResponse } from '@/lib/types';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"; 
import { 
  Plus, 
  Search, 
  AlertTriangle, 
  PackageOpen, 
  Settings2, 
  Trash2, 
  ArchiveRestore, 
  RotateCcw,
  ChevronLeft,  // ✅ Added
  ChevronRight  // ✅ Added
} from 'lucide-react';
import { ProductForm } from './product-form';
import { StockAdjustmentDialog } from '@/components/inventory/stock-adjustment-dialog';
import { ArchiveProductDialog } from '@/components/inventory/archive-product-dialog'; 
import { RestoreProductDialog } from '@/components/inventory/restore-product-dialog';

export default function InventoryPage() {
  // ✅ Pagination & Search State
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1); // Start at page 1

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState("active");

  // Modal States
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [archiveProduct, setArchiveProduct] = useState<Product | null>(null);
  const [restoreProduct, setRestoreProduct] = useState<Product | null>(null);

  const queryClient = useQueryClient();

  // ✅ Updated Fetch Logic
  const { data, isLoading, isError } = useQuery({
    queryKey: ['products', search, currentTab, page], // Refetch on page change
    queryFn: async () => {
      const params: any = { 
          page, 
          page_size: 20 // Optional: enforce size
      };
      
      if (search) params.search = search;
      
      if (currentTab === 'archived') {
        params.deleted = 'true';
      }
      
      const response = await api.get<PaginatedResponse<Product>>('/api/products/', { params });
      return response.data;
    },
  });

  // ✅ Handle Search (Reset page to 1)
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
      setPage(1);
  };

  // ✅ Handle Tabs (Reset page to 1)
  const handleTabChange = (val: string) => {
      setCurrentTab(val);
      setPage(1);
  };

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

      <Tabs defaultValue="active" onValueChange={handleTabChange} className="w-full">
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
                <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search products..."
                    className="pl-8"
                    value={search}
                    onChange={handleSearch} // ✅ Use new handler
                />
                </div>
            </div>
            </CardHeader>
            <CardContent>
            {isLoading ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                Loading inventory...
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
                        <TableHead>SKU</TableHead>
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

                {/* ✅ PAGINATION CONTROLS */}
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
        product={restoreProduct}
        isOpen={!!restoreProduct}
        onClose={() => setRestoreProduct(null)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['products'] })}
      />
    </div>
  );
}