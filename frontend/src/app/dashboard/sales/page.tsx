"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useReactToPrint } from "react-to-print";
import api from "@/lib/api";
import { Product, CartItem } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  PackageOpen,
  LayoutGrid,
  List,
  Printer,
  CheckCircle2,
  History,
  ShoppingBag,
  Wifi,
  WifiOff,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { PosCart } from "./pos-cart";
import { ReceiptTemplate } from "@/components/sales/receipt-template";

const PAGE_SIZE = 12;

// Helper: Debounce Search Input
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function SalesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeTab, setActiveTab] = useState<"pos" | "history">("pos");
  const [page, setPage] = useState(1);
  const [isOnline, setIsOnline] = useState(true);

  // Network Listener
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const [selectedSale, setSelectedSale] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });

  // 1. Settings
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.get("/api/settings/")).data,
    staleTime: Infinity,
  });

  // 2A. ONLINE QUERY
  const { data: apiProductData, isLoading: isApiLoading } = useQuery({
    queryKey: ["products", debouncedSearch, page],
    queryFn: async () => {
      if (!navigator.onLine) return null;
      const params = { search: debouncedSearch, page, page_size: PAGE_SIZE };
      const { data } = await api.get("/api/products/", { params });
      return data;
    },
    enabled: isOnline,
    placeholderData: (prev) => prev,
  });

  // 2B. OFFLINE QUERY
  const localProductData = useLiveQuery(async () => {
    if (isOnline) return null;
    let collection;
    if (!debouncedSearch) {
      collection = db.products.toCollection();
    } else {
      const lower = debouncedSearch.toLowerCase();
      collection = db.products.filter(
        (p) =>
          p.name.toLowerCase().includes(lower) ||
          (p.sku || "").toLowerCase().includes(lower),
      );
    }
    const total = await collection.count();
    const items = await collection
      .offset((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .toArray();
    return { results: items, count: total };
  }, [debouncedSearch, page, isOnline]);

  const products = isOnline
    ? apiProductData?.results
    : localProductData?.results;
  const totalProducts = isOnline
    ? apiProductData?.count
    : localProductData?.count;
  const isLoading = isOnline ? isApiLoading : !localProductData;
  const totalPages = Math.ceil((totalProducts || 0) / PAGE_SIZE);

  // 3. History
  const { data: salesHistory, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["sales", debouncedSearch],
    queryFn: async () => {
      const params = { search: debouncedSearch };
      const { data } = await api.get("/api/sales/", { params });
      return data;
    },
    enabled: activeTab === "history",
  });

  const addToCart = (product: Product) => {
    if (product.quantity <= 0) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity < product.quantity) {
          return prev.map((item) =>
            item.productId === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          );
        }
        return prev;
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: parseFloat(product.price as any),
          quantity: 1,
          maxStock: product.quantity,
        },
      ];
    });
  };

  const removeFromCart = (id: number) =>
    setCart((prev) => prev.filter((item) => item.productId !== id));

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId === id) {
          const newQty = item.quantity + delta;
          if (newQty > 0 && newQty <= item.maxStock)
            return { ...item, quantity: newQty };
        }
        return item;
      }),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold tracking-tight text-[#1A1B4B]">
          Point of Sale
        </h1>
      </div>

      <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row gap-4">
        {/* Left Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-4 gap-4 shrink-0">
            <div className="flex gap-2">
              <Button
                variant={activeTab === "pos" ? "default" : "outline"}
                onClick={() => setActiveTab("pos")}
                className="gap-2"
              >
                <ShoppingBag className="w-4 h-4" /> POS
              </Button>
              <Button
                variant={activeTab === "history" ? "default" : "outline"}
                onClick={() => setActiveTab("history")}
                className="gap-2"
              >
                <History className="w-4 h-4" /> History
              </Button>
            </div>

            {/* Connection Status Indicator */}
            <div className="flex items-center gap-2">
              {isOnline ? (
                <span className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-green-600 bg-green-50 px-3 py-1 rounded-full border-2 border-green-200">
                  <Wifi className="h-3 w-3" /> Online
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1 rounded-full border-2 border-amber-200">
                  <WifiOff className="h-3 w-3" /> Offline Mode
                </span>
              )}
            </div>

            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search products..."
                className="pl-10 border-2 border-slate-200 focus:border-[#2D31FA]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {activeTab === "pos" && (
              <div className="flex gap-1 border-2 rounded-lg p-1 bg-card">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-card rounded-2xl border shadow-sm overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
              {activeTab === "pos" && (
                <div className="flex flex-col h-full">
                  {isLoading ? (
                    <div className="flex items-center justify-center flex-1">
                      <Loader2 className="animate-spin h-8 w-8 text-[#2D31FA]" />
                    </div>
                  ) : !products || products.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                      <PackageOpen className="h-12 w-12 mb-2 opacity-20 text-[#1A1B4B]" />
                      <p className="font-bold">No products found.</p>
                    </div>
                  ) : (
                    <div
                      className={
                        viewMode === "grid"
                          ? "grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                          : "space-y-2"
                      }
                    >
                      {products.map((product: any) => {
                        const inCart =
                          cart.find((c) => c.productId === product.id)
                            ?.quantity || 0;
                        const remaining = product.quantity - inCart;
                        const isOutOfStock = remaining <= 0;
                        return (
                          <Card
                            key={product.id}
                            className={`cursor-pointer transition-all hover:border-[#2D31FA] ${isOutOfStock ? "opacity-50" : "hover:shadow-md"}`}
                            onClick={() => !isOutOfStock && addToCart(product)}
                          >
                            <CardContent
                              className={
                                viewMode === "grid"
                                  ? "p-4"
                                  : "p-3 flex justify-between items-center"
                              }
                            >
                              <div>
                                <h3 className="font-black text-sm line-clamp-2 text-[#1A1B4B]">
                                  {product.name}
                                </h3>
                                <p className="text-xs text-slate-400 font-mono">
                                  {product.sku}
                                </p>
                              </div>
                              <div className="text-right">
                                <Badge
                                  variant={
                                    isOutOfStock ? "destructive" : "secondary"
                                  }
                                  className="text-[10px] uppercase font-black"
                                >
                                  {isOutOfStock ? "OUT" : `${remaining} LEFT`}
                                </Badge>
                                <div className="font-black text-[#2D31FA]">
                                  ₦{parseFloat(product.price).toLocaleString()}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                  {totalProducts > PAGE_SIZE && (
                    <div className="mt-4 flex justify-between border-t pt-4">
                      <span className="text-xs font-bold text-slate-400">
                        Page {page} of {totalPages}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => p - 1)}
                          disabled={page === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => p + 1)}
                          disabled={page >= totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {activeTab === "history" && (
                <div className="h-full">
                  {isHistoryLoading ? (
                    <Loader2 className="animate-spin mx-auto mt-10 text-[#2D31FA]" />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-black uppercase text-xs">
                            Ref
                          </TableHead>
                          <TableHead className="font-black uppercase text-xs">
                            Total
                          </TableHead>
                          <TableHead className="font-black uppercase text-xs">
                            Date
                          </TableHead>
                          <TableHead className="text-right font-black uppercase text-xs">
                            Action
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesHistory?.results?.map((sale: any) => (
                          <TableRow key={sale.id} className="hover:bg-slate-50">
                            <TableCell className="font-mono text-xs">
                              {sale.reference}
                            </TableCell>
                            <TableCell className="font-black text-[#2D31FA]">
                              ₦{Number(sale.total_amount).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-slate-500">
                              {format(
                                new Date(sale.created_at),
                                "MMM d, HH:mm",
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedSale(sale)}
                              >
                                <Printer className="w-3 h-3 mr-1" /> Print
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side Cart & Dialog */}
        {activeTab === "pos" && (
          <div className="w-full md:w-[400px] shrink-0">
            <PosCart
              cart={cart}
              onRemove={removeFromCart}
              onUpdateQty={updateQuantity}
              onClear={() => setCart([])}
              onSaleSuccess={(saleData) => {
                setSelectedSale(saleData);
                setCart([]);
              }}
            />
          </div>
        )}
      </div>

      <Dialog
        open={!!selectedSale}
        onOpenChange={(open) => !open && setSelectedSale(null)}
      >
        <DialogContent className="max-w-[400px] rounded-3xl">
          <div className="text-center p-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-[#1A1B4B]">
              Receipt Ready
            </h2>
            <div className="hidden">
              <ReceiptTemplate
                ref={printRef}
                sale={selectedSale}
                settings={settings}
              />
            </div>
            <div className="flex flex-col gap-3 mt-6">
              <Button
                onClick={() => handlePrint()}
                className="w-full h-12 bg-[#2D31FA] font-black uppercase tracking-widest rounded-xl shadow-lg"
              >
                <Printer className="mr-2 h-4 w-4" /> Print Receipt
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedSale(null)}
                className="w-full h-12 font-bold uppercase rounded-xl border-2"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
