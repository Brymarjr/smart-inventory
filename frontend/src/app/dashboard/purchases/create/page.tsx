'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// ✅ Import the new component
import { ProductCombobox } from '@/components/shared/product-combobox';

export default function CreatePurchasePage() {
  const router = useRouter();
  
  // ✅ Identical State
  const [items, setItems] = useState<{product: string, quantity: number}[]>([
    { product: '', quantity: 1 }
  ]);

  // ✅ Identical Mutation Logic
  const createMutation = useMutation({
    mutationFn: async () => {
        // Simple validation to ensure no empty rows
        const validItems = items.filter(i => i.product && i.quantity > 0);
        if (validItems.length === 0) throw new Error("Please add at least one product");

        const payload = {
            items: validItems.map(i => ({
                product: parseInt(i.product),
                quantity: i.quantity
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
                        
                        {/* ✅ REPLACED: <Select> with <ProductCombobox> */}
                        <div className="flex-1 space-y-2">
                            <Label>Product</Label>
                            <ProductCombobox 
                                value={item.product}
                                onSelect={(id) => updateItem(index, 'product', id)}
                            />
                        </div>

                        <div className="w-32 space-y-2">
                            <Label>Quantity</Label>
                            <Input 
                                type="number" 
                                value={item.quantity} 
                                onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
                                className="bg-white"
                                min={1}
                            />
                        </div>
                        
                        <Button variant="ghost" size="icon" className="text-red-500 mb-0.5" onClick={() => removeItem(index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>

            <Button variant="outline" onClick={() => setItems([...items, { product: '', quantity: 1 }])}>
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