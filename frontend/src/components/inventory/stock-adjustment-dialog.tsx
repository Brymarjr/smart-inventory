'use client';

import { useState, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { inventoryService, Product } from '@/services/inventoryService';

interface Props {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function StockAdjustmentDialog({ product, isOpen, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [newQuantity, setNewQuantity] = useState<string>('');
  const [reason, setReason] = useState<string>('correction');
  const [note, setNote] = useState('');

  // Reset form when opening different product
  useEffect(() => {
    if (isOpen) {
      setNewQuantity('');
      setReason('correction');
      setNote('');
    }
  }, [isOpen, product]);

  const handleSave = async () => {
    if (!product || newQuantity === '') return;

    setLoading(true);
    try {
      await inventoryService.adjustStock(product.id, {
        new_total: parseInt(newQuantity),
        reason: reason as any,
        note: note
      });
      
      toast.success("Stock updated successfully");
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update stock");
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  const current = product.quantity;
  const target = parseInt(newQuantity) || current;
  const diff = target - current;
  const isLoss = diff < 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adjust Stock Level</DialogTitle>
          <DialogDescription>
            Update inventory for <span className="font-semibold text-foreground">{product.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>New Quantity On Hand</Label>
            <div className="flex items-center gap-4">
               <Input 
                 type="number" 
                 value={newQuantity} 
                 onChange={(e) => setNewQuantity(e.target.value)}
                 placeholder={current.toString()}
                 className="text-lg font-bold"
               />
               <div className="text-sm text-muted-foreground whitespace-nowrap">
                 Current: {current}
               </div>
            </div>
            {newQuantity !== '' && diff !== 0 && (
                <div className={`text-xs font-medium flex items-center ${isLoss ? 'text-red-600' : 'text-green-600'}`}>
                    {isLoss ? <AlertTriangle className="mr-1 h-3 w-3" /> : null}
                    {diff > 0 ? `Adding ${diff} items` : `Removing ${Math.abs(diff)} items`}
                </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Reason for Change</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="restock">Restock / Purchase</SelectItem>
                <SelectItem value="correction">Inventory Correction</SelectItem>
                <SelectItem value="damage">Damaged / Expired</SelectItem>
                <SelectItem value="theft">Theft / Shrinkage</SelectItem>
                <SelectItem value="return">Customer Return</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Notes (Optional)</Label>
            <Textarea 
              placeholder="Details..." 
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading || newQuantity === ''}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}