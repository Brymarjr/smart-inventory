'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Category, PaginatedResponse, Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useEffect } from 'react';

// ✅ Schema updated with custom error messages
const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  sku: z.string().min(1, 'SKU is required'),
  price: z.string().min(1, 'Selling price is required'),
  cost_price: z.string().min(1, 'Cost price is required'),
  quantity: z.string().min(1, 'Initial quantity is required'),
  reorder_level: z.string().min(1, 'Reorder level is required'),
  description: z.string().optional(),
  // Standard string check: handles both empty string and undefined
  category_id: z.string().min(1, "Please select a category"),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductFormProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null; 
  mode?: 'create' | 'view' | 'edit';
}

export function ProductForm({ isOpen, onClose, product, mode = 'create' }: ProductFormProps) {
  const queryClient = useQueryClient();
  const isViewMode = mode === 'view';

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      sku: '',
      price: '',
      cost_price: '',
      quantity: '0',
      reorder_level: '10',
      description: '',
      category_id: '',
    },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        sku: product.sku,
        price: product.price.toString(),
        cost_price: product.cost_price?.toString() || '0',
        quantity: product.quantity.toString(),
        reorder_level: (product as any).reorder_level?.toString() || '10',
        description: product.description || '',
        category_id: (product as any).category?.id?.toString() || '',
      });
    } else {
      form.reset();
    }
  }, [product, form, isOpen]);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Category>>('/api/categories/');
      return data.results;
    },
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      const payload = {
        name: values.name,
        sku: values.sku,
        price: parseFloat(values.price),
        cost_price: parseFloat(values.cost_price),
        quantity: parseInt(values.quantity),
        reorder_level: parseInt(values.reorder_level),
        description: values.description,
        category_id: parseInt(values.category_id),
      };
      
      if (mode === 'edit' && product) {
        await api.patch(`/api/products/${product.id}/`, payload);
      } else {
        await api.post('/api/products/', payload);
      }
    },
    onSuccess: () => {
      toast.success(mode === 'edit' ? 'Product updated successfully' : 'Product created successfully');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      form.reset();
      onClose();
    },
    onError: (error: any) => {
      const msg = error.response?.data?.sku?.[0] || "Failed to save product. Check for duplicate SKU.";
      toast.error(msg);
    }
  });

  function onSubmit(values: ProductFormValues) {
    if (isViewMode) return;
    createMutation.mutate(values);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="overflow-y-auto max-h-[90vh] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isViewMode ? 'Product Insights' : mode === 'edit' ? 'Edit Product' : 'Add New Product'}
          </DialogTitle>
          <DialogDescription>
            {isViewMode ? 'Strategic procurement history and cost analysis.' : 'Define product details and inventory thresholds.'}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl><Input disabled={isViewMode} placeholder="e.g. Paracetamol" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU / Product ID</FormLabel>
                    <FormControl><Input disabled={isViewMode} placeholder="e.g. PC-001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cost_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Price (₦)</FormLabel>
                    <FormControl><Input type="number" disabled={isViewMode} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selling Price (₦)</FormLabel>
                    <FormControl><Input type="number" disabled={isViewMode} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select 
                    disabled={isViewMode} 
                    onValueChange={field.onChange} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isViewMode && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock Quantity</FormLabel>
                      <FormControl><Input type="number" disabled={mode === 'edit'} {...field} /></FormControl>
                      <FormDescription className="text-[10px]">Initial stock for new products.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reorder_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reorder Level</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea disabled={isViewMode} placeholder="Optional product description..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isViewMode && product?.supplier_prices && (
              <div className="space-y-4 py-2">
                 <div className="flex items-center gap-2 text-primary pt-2">
                  <History className="h-4 w-4" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">Price History</h3>
                </div>
                <Separator />
                <div className="grid gap-2">
                  {product.supplier_prices.length === 0 ? (
                    <div className="p-4 rounded-lg bg-muted text-center text-xs text-muted-foreground italic border-dashed border-2">
                      No procurement history for this item.
                    </div>
                  ) : (
                    product.supplier_prices.map((sp: any) => (
                      <div key={sp.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border shadow-sm">
                        <div>
                          <p className="text-xs font-bold text-slate-900">{sp.supplier_name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-medium">Updated: {new Date(sp.last_updated).toLocaleDateString()}</p>
                        </div>
                        <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 font-bold">
                          ₦{parseFloat(sp.supply_price).toLocaleString()}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {!isViewMode && (
              <div className="flex justify-end gap-3 pt-6">
                <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending} className="px-8">
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === 'edit' ? 'Update Product' : 'Create Product'}
                </Button>
              </div>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}