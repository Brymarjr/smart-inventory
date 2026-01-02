'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Product, PaginatedResponse } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Search, AlertTriangle, PackageOpen } from 'lucide-react';
import { useState } from 'react';
import { ProductForm } from './product-form';

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Fetch Products
  const { data, isLoading, isError } = useQuery({
    queryKey: ['products', search],
    queryFn: async () => {
      const params = search ? { search } : {};
      const response = await api.get<PaginatedResponse<Product>>('/api/products/', { params });
      return response.data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Manage your stock levels and catalog.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Products</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.results?.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        {product.name}
                        {/* Check if stock is below reorder level */}
                        {product.quantity <= product.reorder_level && (
                          <span className="ml-2 inline-flex items-center text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Low
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{product.sku}</TableCell>

                      {/* Access nested category object */}
                      <TableCell>{product.category?.name || '-'}</TableCell>

                      {/* Use 'price' instead of 'unit_price' */}
                      <TableCell className="text-right">
                        ₦{parseFloat(product.price).toLocaleString()}
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge variant={product.quantity > 0 ? "outline" : "destructive"}>
                          {product.quantity}
                        </Badge>
                      </TableCell>

                      {/* Changed 'Status' logic to use Green Color for Stock */}
                      <TableCell>
                        <Badge
                          className={
                            product.quantity > 0
                              ? "bg-green-600 hover:bg-green-700 text-white" // Force Green
                              : "bg-gray-500 hover:bg-gray-600 text-white"   // Force Grey
                          }
                        >
                          {product.quantity > 0 ? 'In Stock' : 'Out of Stock'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ProductForm isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </div>
  );
}