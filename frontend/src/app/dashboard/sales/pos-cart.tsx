'use client';

import { useState } from 'react';
import { CartItem, SalePayload } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Trash2, ShoppingCart, Loader2, CreditCard } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';

interface PosCartProps {
  cart: CartItem[];
  onRemove: (id: number) => void;
  onUpdateQty: (id: number, delta: number) => void;
  onClear: () => void;
  // ✅ NEW: Callback to trigger the parent's print dialog
  onSaleSuccess: (data: any) => void; 
}

export function PosCart({ cart, onRemove, onUpdateQty, onClear, onSaleSuccess }: PosCartProps) {
  const queryClient = useQueryClient();
  
  // Checkout Form State
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'pos' | 'other'>('cash');
  const [notes, setNotes] = useState('');

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Checkout Mutation
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const payload: SalePayload = {
        customer_name: customerName,
        payment_method: paymentMethod,
        notes: notes,
        items: cart.map(item => ({
          product: item.productId, // Ensure your backend expects 'product_id' or 'product'
          quantity: item.quantity
        }))
      };
      // ✅ RETURN the data so we can use it in onSuccess
      const res = await api.post('/api/sales/', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Sale completed successfully!');
      
      // ✅ TRIGGER THE PRINT DIALOG IN PARENT
      onSaleSuccess(data);

      onClear(); 
      setCustomerName('');
      setNotes('');
      setPaymentMethod('cash');
      queryClient.invalidateQueries({ queryKey: ['products'] }); 
      queryClient.invalidateQueries({ queryKey: ['sales'] });    
    },
    onError: (error: any) => {
      console.error(error);
      const msg = error.response?.data?.items 
        ? (Array.isArray(error.response.data.items) ? error.response.data.items[0] : error.response.data.items)
        : error.response?.data?.message || 'Checkout failed. Please try again.';
      toast.error(typeof msg === 'object' ? JSON.stringify(msg) : msg);
    }
  });

  if (cart.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 border rounded-lg bg-gray-50/50 border-dashed">
        <ShoppingCart className="h-12 w-12 mb-4 opacity-20" />
        <p className="text-lg font-medium">Cart is empty</p>
        <p className="text-sm">Select products to start a sale.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white border rounded-lg shadow-sm">
      {/* HEADER */}
      <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
        <h2 className="font-semibold flex items-center">
          <ShoppingCart className="mr-2 h-4 w-4" /> Current Order
        </h2>
        <Button variant="ghost" size="sm" onClick={onClear} className="text-red-500 hover:text-red-600 hover:bg-red-50">
          Clear
        </Button>
      </div>

      {/* ITEMS LIST */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {cart.map((item) => (
          <div key={item.productId} className="flex items-center justify-between group">
            <div className="flex-1">
              <p className="font-medium text-sm truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground">₦{item.price.toLocaleString()}</p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center border rounded-md">
                <button 
                   onClick={() => onUpdateQty(item.productId, -1)}
                   className="px-2 py-1 hover:bg-gray-100 text-sm disabled:opacity-50"
                   disabled={item.quantity <= 1}
                >-</button>
                <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                <button 
                   onClick={() => onUpdateQty(item.productId, 1)}
                   className="px-2 py-1 hover:bg-gray-100 text-sm disabled:opacity-50"
                   disabled={item.quantity >= item.maxStock}
                >+</button>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onRemove(item.productId)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="w-20 text-right font-medium text-sm">
              ₦{(item.price * item.quantity).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* CHECKOUT SECTION */}
      <div className="p-4 bg-gray-50 border-t space-y-4 rounded-b-lg">
        <div className="grid grid-cols-2 gap-3">
            <Input 
                placeholder="Customer Name (Optional)" 
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="bg-white"
            />
            <Select value={paymentMethod} onValueChange={(val: any) => setPaymentMethod(val)}>
                <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Payment" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="pos">POS / Card</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                </SelectContent>
            </Select>
        </div>

        <Separator />

        <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Amount</span>
            <span className="text-2xl font-bold text-primary">₦{totalAmount.toLocaleString()}</span>
        </div>

        <Button 
            size="lg" 
            className="w-full text-lg" 
            onClick={() => checkoutMutation.mutate()}
            disabled={checkoutMutation.isPending}
        >
            {checkoutMutation.isPending ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
                <CreditCard className="mr-2 h-5 w-5" />
            )}
            {checkoutMutation.isPending ? 'Processing...' : 'Complete Sale'}
        </Button>
      </div>
    </div>
  );
}