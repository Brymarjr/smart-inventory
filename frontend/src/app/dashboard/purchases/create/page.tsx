"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Loader2, Zap, Info, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ProductCombobox } from "@/components/shared/product-combobox";

interface PurchaseItem {
  product: string;
  quantity: number;
  recommendation?: {
    supplier_name: string;
    best_price: number;
    savings_vs_current: number;
  } | null;
}

export default function CreatePurchasePage() {
  const router = useRouter();
  const [items, setItems] = useState<PurchaseItem[]>([
    { product: "", quantity: 1, recommendation: null },
  ]);

  // 1. Fetch Price Recommendation logic
  const checkBestPrice = async (index: number, productId: string) => {
    if (!productId) return;
    try {
      const { data } = await api.get(`/api/products/${productId}/best-price/`);
      const newItems = [...items];
      newItems[index].recommendation = data; // Will be null if no history exists
      setItems(newItems);
    } catch (err) {
      console.error("Procurement check failed", err);
    }
  };

  // 2. Submission Logic
  const createMutation = useMutation({
    mutationFn: async () => {
      const validItems = items.filter((i) => i.product && i.quantity > 0);
      if (validItems.length === 0) throw new Error("Please add at least one product");

      const payload = {
        items: validItems.map((i) => ({
          product: parseInt(i.product),
          quantity: i.quantity,
        })),
      };
      await api.post("/api/purchases/", payload);
    },
    onSuccess: () => {
      toast.success("Purchase Request Submitted");
      router.push("/dashboard/purchases");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit request.");
    },
  });

  const updateItem = (index: number, field: keyof PurchaseItem, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);

    if (field === "product") {
      checkBestPrice(index, value);
    }
  };

  const removeItem = (index: number) => {
    if (items.length === 1) {
      setItems([{ product: "", quantity: 1, recommendation: null }]);
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4 mb-2">
         <div className="bg-primary/10 p-2 rounded-lg">
            <ShoppingCart className="h-6 w-6 text-primary" />
         </div>
         <div>
            <h1 className="text-2xl font-bold">New Purchase Order</h1>
            <p className="text-muted-foreground text-sm">Draft a stock request for manager approval.</p>
         </div>
      </div>

      <Card className="border-t-4 border-t-primary">
        <CardHeader>
          <CardTitle>Request Items</CardTitle>
          <CardDescription>Select products and quantities. Our AI will suggest the best suppliers based on history.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-6">
            {items.map((item, index) => (
              <div key={index} className="animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="flex gap-4 items-end border p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex-1 space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Product</Label>
                    <ProductCombobox
                      value={item.product}
                      onSelect={(id) => updateItem(index, "product", id)}
                    />
                  </div>

                  <div className="w-32 space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Quantity</Label>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value))}
                      className="bg-background font-semibold"
                      min={1}
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-full"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* 🎯 CHEAPEST SUPPLIER RECOMMENDATION */}
                {item.recommendation && (
                  <div className="mt-2 ml-4 flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-sm text-blue-900 animate-in zoom-in-95 duration-300">
                    <Zap className="h-4 w-4 fill-blue-500 text-blue-500 shrink-0" />
                    <div className="flex-1">
                      <span className="font-medium">Strategic Source:</span> Buy from <span className="font-bold">{item.recommendation.supplier_name}</span> at 
                      <span className="mx-1 font-bold">₦{item.recommendation.best_price.toLocaleString()}</span>
                      {item.recommendation.savings_vs_current > 0 && (
                        <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700 border-green-200">
                          Save ₦{item.recommendation.savings_vs_current.toLocaleString()}/unit
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col md:flex-row gap-4 justify-between items-center pt-6 border-t">
            <Button
              variant="outline"
              className="w-full md:w-auto border-dashed hover:border-primary hover:text-primary transition-all"
              onClick={() => setItems([...items, { product: "", quantity: 1, recommendation: null }])}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Another Product
            </Button>
            
            <div className="flex gap-3 w-full md:w-auto">
                <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
                <Button
                  size="lg"
                  className="w-full md:w-auto font-bold shadow-lg shadow-primary/20"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    "Submit for Approval"
                  )}
                </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* EDUCATIONAL FOOTER FOR THESIS RIGOR */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
        <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 space-y-1">
            <p className="font-bold uppercase tracking-wider">Procurement Optimization Active</p>
            <p>ForeTrack analyzes your historical purchase orders to identify cost-saving opportunities. 
               Recommendations are refreshed every time a manager confirms a payment to a supplier.</p>
        </div>
      </div>
    </div>
  );
}