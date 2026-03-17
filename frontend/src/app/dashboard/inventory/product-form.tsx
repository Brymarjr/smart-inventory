'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Category, Supplier, PaginatedResponse } from '@/lib/types';
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

// ✅ Swapped Sheet for Dialog to make it a centered modal
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  sku: z.string().min(1, 'SKU is required'),
  price: z.string().min(1, 'Price is required'),
  cost_price: z.string().min(1, 'Cost price is required'),
  quantity: z.string().min(1, 'Quantity is required'),
  reorder_level: z.string().min(1, 'Reorder level is required'),
  description: z.string().optional(),
  category_id: z.string().optional(),
  supplier_id: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProductForm({ isOpen, onClose }: ProductFormProps) {
  const queryClient = useQueryClient();

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
      category_id: undefined,
      supplier_id: undefined,
    },
  });

  // Fetch Categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Category>>('/api/categories/');
      return data.results;
    },
    enabled: isOpen,
  });

  // Fetch Suppliers
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Supplier>>('/api/suppliers/');
      return data.results;
    },
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      const payload = {
        ...values,
        price: parseFloat(values.price),
        cost_price: parseFloat(values.cost_price),
        quantity: parseInt(values.quantity),
        reorder_level: parseInt(values.reorder_level),
        category_id: values.category_id ? parseInt(values.category_id) : null,
        supplier_id: values.supplier_id ? parseInt(values.supplier_id) : null,
      };
      await api.post('/api/products/', payload);
    },
    onSuccess: () => {
      toast.success('Product created successfully');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }); // Refresh dashboard
      form.reset();
      onClose();
    },
    onError: (error: any) => {
      console.error("API Error:", error);
      const data = error.response?.data;

      const generalError = data?.detail || data?.non_field_errors?.[0] || (Array.isArray(data) ? data[0] : null);

      if (generalError && typeof generalError === 'string' && generalError.toLowerCase().includes('limit')) {
          toast.error("Plan Limit Reached! Please upgrade your subscription.");
          return;
      }

      if (data?.sku) {
          toast.error(`SKU Error: ${data.sku[0]}`);
          return;
      }

      toast.error("Failed to create product. Please try again.");
    },
  });

  function onSubmit(values: ProductFormValues) {
    createMutation.mutate(values);
  }

  return (
    // ✅ Replaced Sheet with Dialog
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="overflow-y-auto max-h-[90vh] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>
            Create a new item in your inventory catalog.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name *</FormLabel>
                      <FormControl><Input placeholder="e.g. Wireless Mouse" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product ID *</FormLabel>
                      <FormControl><Input placeholder="e.g. WM-001" {...field} /></FormControl>
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
                      <FormLabel>Cost Price (₦) *</FormLabel>
                      <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormDescription className="text-[10px]">Your buying price.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selling Price (₦) *</FormLabel>
                      <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Stock</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories?.map((c) => (
                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="supplier_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {suppliers?.map((s) => (
                            <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Details..." className="resize-none" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Product
                </Button>
              </div>

            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}