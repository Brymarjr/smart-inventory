'use client';

import { useState, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Trash2, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { inventoryService, Product } from '@/services/inventoryService';

interface Props {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ArchiveProductDialog({ product, isOpen, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('discontinued');
  const [note, setNote] = useState('');

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setReason('discontinued');
      setNote('');
    }
  }, [isOpen]);

  const handleArchive = async () => {
    if (!product) return;
    setLoading(true);
    try {
      await inventoryService.archiveProduct(product.id, { reason, note });
      toast.success("Product archived successfully");
      onSuccess();
      onClose();
    } catch (err: any) {
        // Handle "Protected" error (Sales exist)
       if (err.response?.status === 400 || err.response?.status === 500) {
        toast.error("Cannot archive: Active sales history detected.");
       } else {
        toast.error("Failed to archive product");
       }
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] border-red-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
             <Trash2 className="h-5 w-5" /> Archive Product
          </DialogTitle>
          <DialogDescription>
            You are about to remove <span className="font-bold text-foreground">{product.name}</span> from the active list.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Reason for Deletion</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="discontinued">Discontinued Product</SelectItem>
                <SelectItem value="mistake">Entry Mistake</SelectItem>
                <SelectItem value="defect">Defective / Damaged</SelectItem>
                <SelectItem value="seasonal">End of Season</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Additional Notes</Label>
            <Textarea 
              placeholder="Any details for the audit log..." 
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="destructive" onClick={handleArchive} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Archive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}