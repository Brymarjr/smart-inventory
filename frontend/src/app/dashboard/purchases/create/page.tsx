'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { Product, PaginatedResponse } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function CreatePurchasePage() {
  const router = useRouter();
  
  // Cart State for the Request
  const [items, setItems] = useState<{product: string, quantity: number, unit_cost: number}[]>([
    { product: '', quantity: 1, unit_cost: 0 }
  ]);

  // Fetch Products
  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Product>>('/api/products/');
      return data.results;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
        // Backend expects: items: [{ product: id, quantity, unit_cost }]
        // My form has product as string ID, need to convert to int if backend expects int
        const payload = {
            items: items.map(i => ({
                product: parseInt(i.product),
                quantity: i.quantity,
                unit_cost: i.unit_cost
            }))
        };
        await api.post('/api/purchases/', payload);
    },
    onSuccess: () => {
        toast.success('Purchase Request Submitted');
        router.push('/dashboard/purchases');
    },
    onError: (err: any) => {
        console.error(err);
        toast.error('Failed to submit request.');
    }
  });

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
            <CardTitle>Create Purchase Request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-4">
                {items.map((item, index) => (
                    <div key={index} className="flex gap-4 items-end border p-4 rounded-md bg-slate-50">
                        <div className="flex-1 space-y-2">
                            <Label>Product</Label>
                            <Select 
                                value={item.product} 
                                onValueChange={(val) => updateItem(index, 'product', val)}
                            >
                                <SelectTrigger className="bg-white">
                                    <SelectValue placeholder="Select Product" />
                                </SelectTrigger>
                                <SelectContent>
                                    {products?.map(p => (
                                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-24 space-y-2">
                            <Label>Qty</Label>
                            <Input 
                                type="number" 
                                value={item.quantity} 
                                onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
                                className="bg-white"
                                min={1}
                            />
                        </div>
                        <div className="w-32 space-y-2">
                            <Label>Est. Cost</Label>
                            <Input 
                                type="number" 
                                value={item.unit_cost} 
                                onChange={(e) => updateItem(index, 'unit_cost', parseFloat(e.target.value))}
                                className="bg-white"
                                min={0}
                            />
                        </div>
                        <Button variant="ghost" size="icon" className="text-red-500" onClick={() => removeItem(index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>

            <Button variant="outline" onClick={() => setItems([...items, { product: '', quantity: 1, unit_cost: 0 }])}>
                <Plus className="mr-2 h-4 w-4" /> Add Another Item
            </Button>

            <div className="pt-4 border-t flex justify-end">
                <Button size="lg" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit Request
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}