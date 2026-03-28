"use client";

import { useState } from "react";
import { CartItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Trash2, ShoppingCart, Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { queueOperation } from "@/lib/sync-manager";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";

interface PosCartProps {
  cart: CartItem[];
  onRemove: (id: number) => void;
  onUpdateQty: (id: number, delta: number) => void;
  onClear: () => void;
  onSaleSuccess: (data: any) => void;
}

export function PosCart({
  cart,
  onRemove,
  onUpdateQty,
  onClear,
  onSaleSuccess,
}: PosCartProps) {
  const { user } = useAuth();
  // Checkout Form State
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "card" | "transfer" | "pos" | "other"
  >("cash");
  const [notes, setNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

 // ✅ Smart Checkout Logic (Optimized for Online-Direct/Offline-Queue)
const handleCheckout = async () => {
  if (cart.length === 0) return;
  setIsProcessing(true);

  // 1. Initial Setup
  const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
  const saleTmpId = `sale-${uuidv4()}`;
  const timestamp = Date.now();
  // We use POS- for everything online, OFF- only for true offline
  const reference = isOnline ? `POS-${timestamp}` : `OFF-${timestamp}`;

  const saleData = {
    tmp_id: saleTmpId,
    reference: reference,
    customer_name: customerName,
    payment_method: paymentMethod,
    total_amount: totalAmount,
    notes: notes,
    created_at: new Date().toISOString(),
    items: cart.map((c) => ({
      product_id: c.productId,
      quantity: c.quantity,
      unit_price: c.price,
      subtotal: c.price * c.quantity,
    })),
  };

  try {
    // 2. OPTIMISTIC UPDATE (Instant UI feedback)
    for (const item of cart) {
      const currentProduct = await db.products.get(item.productId);
      if (currentProduct) {
        await db.products.update(item.productId, {
          quantity: currentProduct.quantity - item.quantity,
        });
      }
    }

    // 3. EXECUTION GATEWAY
    let success = false;

    if (isOnline) {
      try {
        // Try the direct API first
        await api.post("/api/sales/", saleData);
        toast.success("Sale Completed!");
        success = true;
      } catch (apiError: any) {
        // If the server is down or localhost is unreachable, we don't 'throw',
        // we just let 'success' stay false so the code falls through to the queue.
        console.warn("API Reachability issue, falling back to local queue.");
      }
    }

    // 4. OFFLINE FALLBACK (Only runs if success is false)
    if (!success) {
      // This is the ONLY place queueOperation should be called for a sale
      await queueOperation("sales.Sale", "create", saleData);
      
      if (isOnline) {
        toast.info("Network lag: Sale queued for sync.");
      } else {
        toast.info("Offline: Sale saved locally.");
      }
    }

    // 5. RECEIPT GENERATION (Always uses the same data)
    const receiptData = {
      id: saleTmpId,
      receipt_id: reference,
      is_offline: !success,
      cashier_name: user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.username,
      customer_name: customerName,
      total_amount: totalAmount,
      created_at: new Date().toISOString(),
      items: cart.map((c) => ({
        product_name: c.name,
        quantity: c.quantity,
        unit_price: c.price,
        subtotal: c.price * c.quantity,
      })),
    };

    onSaleSuccess(receiptData);
    
    // 6. CLEANUP
    onClear();
    setCustomerName("");
    setNotes("");
    setPaymentMethod("cash");

  } catch (error) {
    console.error("Critical Checkout Error:", error);
    toast.error("An error occurred. Please check your sales history.");
  } finally {
    setIsProcessing(false);
  }
};

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
    <div className="flex flex-col h-full bg-card border rounded-lg shadow-sm">
      {/* HEADER */}
      <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
        <h2 className="font-semibold flex items-center">
          <ShoppingCart className="mr-2 h-4 w-4" /> Current Order
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-red-500 hover:text-red-600 hover:bg-red-50"
        >
          Clear
        </Button>
      </div>

      {/* ITEMS LIST */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {cart.map((item) => (
          <div
            key={item.productId}
            className="flex items-center justify-between group"
          >
            <div className="flex-1">
              <p className="font-medium text-sm truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                ₦{item.price.toLocaleString()}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center border rounded-md">
                <button
                  onClick={() => onUpdateQty(item.productId, -1)}
                  className="px-2 py-1 hover:bg-gray-100 text-sm disabled:opacity-50"
                  disabled={item.quantity <= 1}
                >
                  -
                </button>
                <span className="w-8 text-center text-sm font-medium">
                  {item.quantity}
                </span>
                <button
                  onClick={() => onUpdateQty(item.productId, 1)}
                  className="px-2 py-1 hover:bg-gray-100 text-sm disabled:opacity-50"
                  disabled={item.quantity >= item.maxStock}
                >
                  +
                </button>
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
            className="bg-card"
          />
          <Select
            value={paymentMethod}
            onValueChange={(val: any) => setPaymentMethod(val)}
          >
            <SelectTrigger className="bg-card">
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
          <span className="text-2xl font-bold text-primary">
            ₦{totalAmount.toLocaleString()}
          </span>
        </div>

        <Button
          size="lg"
          className="w-full text-lg"
          onClick={handleCheckout}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <CreditCard className="mr-2 h-5 w-5" />
          )}
          {isProcessing ? "Processing..." : "Complete Sale"}
        </Button>
      </div>
    </div>
  );
}
