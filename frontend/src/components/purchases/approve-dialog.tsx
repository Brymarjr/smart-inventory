'use client';

import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PaginatedResponse, Supplier } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface ApproveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: any;
}

export function ApproveDialog({ isOpen, onClose, purchase }: ApproveDialogProps) {
  const queryClient = useQueryClient();

  const { control, register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      supplier_id: '',
      items: [] as any[]
    }
  });

  const { fields } = useFieldArray({ control, name: "items" });

  // Load data when modal opens
  useEffect(() => {
    if (isOpen && purchase) {
      reset({
        supplier_id: purchase.supplier?.toString() || '',
        items: purchase.items.map((item: any) => ({
          id: item.id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_cost: '' // Manager must fill this
        }))
      });
    }
  }, [isOpen, purchase, reset]);

  // Fetch Suppliers (in case one wasn't assigned yet)
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Supplier>>('/api/suppliers/');
      return data.results;
    },
    enabled: isOpen
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (!data.supplier_id) throw new Error("Supplier is required");

      const payload = {
        supplier: parseInt(data.supplier_id),
        items: data.items.map((it: any) => ({
          id: it.id,
          unit_cost: parseFloat(it.unit_cost)
        }))
      };
      await api.post(`/api/purchases/${purchase.id}/approve/`, payload);
    },
    onSuccess: () => {
      toast.success("Purchase Approved");
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to approve");
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Approve PO #{purchase?.reference}</DialogTitle>
          <DialogDescription>Assign a supplier and enter the confirmed <strong>Unit Cost</strong>.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
          
          <div className="space-y-2">
            <Label>Supplier *</Label>
            <Select 
                value={watch('supplier_id')} 
                onValueChange={(val) => setValue('supplier_id', val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers?.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-24 text-right">Qty</TableHead>
                  <TableHead className="w-40">Cost Price (₦)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => (
                  <TableRow key={field.id}>
                    <TableCell>{field.product_name}</TableCell>
                    <TableCell className="text-right">{field.quantity}</TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        {...register(`items.${index}.unit_cost` as const, { required: true })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve Order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}