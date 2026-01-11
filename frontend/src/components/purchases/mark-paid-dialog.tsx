'use client';

import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface MarkPaidDialogProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: any;
}

export function MarkPaidDialog({ isOpen, onClose, purchase }: MarkPaidDialogProps) {
  const queryClient = useQueryClient();

  const { control, register, handleSubmit, reset } = useForm({
    defaultValues: { items: [] as any[] }
  });

  const { fields } = useFieldArray({ control, name: "items" });

  useEffect(() => {
    if (isOpen && purchase) {
      reset({
        items: purchase.items.map((item: any) => ({
          id: item.id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_cost: item.unit_cost, // Display only
          new_price: '' // Manager must fill this
        }))
      });
    }
  }, [isOpen, purchase, reset]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        items: data.items.map((it: any) => ({
          id: it.id,
          new_price: parseFloat(it.new_price)
        }))
      };
      await api.post(`/api/purchases/${purchase.id}/mark_paid/`, payload);
    },
    onSuccess: () => {
      toast.success("Payment Recorded");
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); 
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to record payment");
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mark PO #{purchase?.reference} as Paid</DialogTitle>
          <DialogDescription>
            Confirming payment will update stock levels. Please set the <strong>Selling Price</strong> for these new items.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-24 text-right">Qty</TableHead>
                  <TableHead className="w-32 text-right">Cost</TableHead>
                  <TableHead className="w-40">New Sell Price (₦)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => (
                  <TableRow key={field.id}>
                    <TableCell>{field.product_name}</TableCell>
                    <TableCell className="text-right">{field.quantity}</TableCell>
                    <TableCell className="text-right">₦{parseFloat(field.unit_cost).toLocaleString()}</TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        {...register(`items.${index}.new_price` as const, { required: true })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}