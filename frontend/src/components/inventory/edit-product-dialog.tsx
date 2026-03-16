'use client';

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import api from "@/lib/api";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface EditProductFormData {
  name: string;
  sku: string;
  price: number;
  reorder_level: number;
  note: string;
}

interface EditProductDialogProps {
  product: any; // The product object passed from your table
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProductDialog({ product, open, onOpenChange }: EditProductDialogProps) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditProductFormData>();

  // Pre-fill the form whenever a new product is selected
  useEffect(() => {
    if (product) {
      reset({
        name: product.name || "",
        sku: product.sku || "",
        price: product.price || 0,
        reorder_level: product.reorder_level || 10,
        note: "", // Always start with a blank note for the new audit log
      });
    }
  }, [product, reset]);

  const mutation = useMutation({
    mutationFn: async (data: EditProductFormData) => {
      // We use PATCH so we only update the fields that actually changed
      const payload = {
        ...data,
        reason: "correction" // Tells the backend this is an administrative edit
      };
      await api.patch(`/api/products/${product.id}/`, payload);
    },
    onSuccess: () => {
      toast.success("Product updated successfully!");
      queryClient.invalidateQueries({ queryKey: ['products'] }); // Refresh the table
      onOpenChange(false); // Close the modal
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to update product.");
    }
  });

  const onSubmit = (data: EditProductFormData) => {
    mutation.mutate(data);
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>
            Make changes to {product.name}. This will be recorded in the audit logs.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Product Name</Label>
            <Input id="name" {...register("name", { required: true })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="sku">SKU / Barcode</Label>
              <Input id="sku" {...register("sku")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="price">Price (₦)</Label>
              <Input id="price" type="number" step="0.01" {...register("price", { required: true, min: 0 })} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="reorder_level">Reorder Level (Low Stock Alert)</Label>
            <Input id="reorder_level" type="number" {...register("reorder_level", { required: true, min: 0 })} />
            <p className="text-xs text-muted-foreground">Alert triggers when stock falls below this number.</p>
          </div>

          <div className="grid gap-2 pt-2 border-t">
            <Label htmlFor="note">Audit Note (Optional)</Label>
            <Textarea 
              id="note" 
              placeholder="Why are you making this change?" 
              {...register("note")} 
              className="resize-none h-20"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}