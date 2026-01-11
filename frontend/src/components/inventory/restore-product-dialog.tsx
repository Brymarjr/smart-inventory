'use client';

import { useState } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { inventoryService, Product } from '@/services/inventoryService';

interface Props {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RestoreProductDialog({ product, isOpen, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);

  const handleRestore = async () => {
    if (!product) return;
    setLoading(true);
    try {
      await inventoryService.restoreProduct(product.id);
      toast.success("Product restored successfully");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error("Failed to restore product");
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] border-green-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-700">
             <RotateCcw className="h-5 w-5" /> Restore Product
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to restore <span className="font-bold text-foreground">{product.name}</span>?
            <br/>
            It will reappear in your active inventory immediately.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button 
            onClick={handleRestore} 
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Restore
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}